//! Per-lab HTTP dialects. The Verb contract and the system prompt are shared;
//! only the envelope (URL, headers, JSON wrap) changes.

use serde_json::{Value, json};
use tessera_session::{Credentials, ProviderError, ProviderName};

use crate::prompt::SYSTEM;
use crate::transport::{HttpRequest, HttpResponse};

const ANTHROPIC_MODEL: &str = "claude-haiku-4-5";
const OPENAI_MODEL: &str = "gpt-4.1-nano";
const GOOGLE_MODEL: &str = "gemini-2.5-flash";

/// Pack Intent + the shared Verb contract into the chosen lab's POST.
pub fn pack(credentials: &Credentials, intent: &str) -> HttpRequest {
    match credentials.provider {
        ProviderName::Anthropic => HttpRequest {
            url: "https://api.anthropic.com/v1/messages".to_string(),
            headers: vec![
                ("content-type".into(), "application/json".into()),
                ("x-api-key".into(), credentials.key.clone()),
                ("anthropic-version".into(), "2023-06-01".into()),
            ],
            body: json!({
                "model": ANTHROPIC_MODEL,
                "max_tokens": 4096,
                "system": SYSTEM,
                "messages": [{ "role": "user", "content": intent }],
            })
            .to_string(),
        },
        ProviderName::OpenAI => HttpRequest {
            url: "https://api.openai.com/v1/chat/completions".to_string(),
            headers: vec![
                ("content-type".into(), "application/json".into()),
                (
                    "authorization".into(),
                    format!("Bearer {}", credentials.key),
                ),
            ],
            body: json!({
                "model": OPENAI_MODEL,
                "max_completion_tokens": 4096,
                "messages": [
                    { "role": "system", "content": SYSTEM },
                    { "role": "user", "content": intent },
                ],
            })
            .to_string(),
        },
        ProviderName::Google => HttpRequest {
            url: format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{GOOGLE_MODEL}:generateContent"
            ),
            headers: vec![
                ("content-type".into(), "application/json".into()),
                ("x-goog-api-key".into(), credentials.key.clone()),
            ],
            body: json!({
                "systemInstruction": { "parts": [{ "text": SYSTEM }] },
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": intent }],
                }],
                "generationConfig": { "maxOutputTokens": 4096 },
            })
            .to_string(),
        },
    }
}

/// Turn a lab HTTP response into model text, or a Person-facing Key error.
pub fn unpack(provider: ProviderName, response: &HttpResponse) -> Result<String, ProviderError> {
    match provider {
        ProviderName::Anthropic => unpack_anthropic(response),
        ProviderName::OpenAI => unpack_openai(response),
        ProviderName::Google => unpack_google(response),
    }
}

fn unpack_anthropic(response: &HttpResponse) -> Result<String, ProviderError> {
    let body = parse_json(&response.body);
    if response.status == 401
        || type_is(&body, "authentication_error")
        || type_is(&body, "permission_error")
    {
        return Err(ProviderError::InvalidKey);
    }
    if response.status == 402
        || type_is(&body, "billing_error")
        || error_code(&body) == Some("enforced_spend_limit_reached")
    {
        return Err(ProviderError::OutOfCredit);
    }
    if response.status == 429 {
        let retry = header(&response.headers, "retry-after");
        if retry.is_none() || error_code(&body) == Some("enforced_spend_limit_reached") {
            return Err(ProviderError::OutOfCredit);
        }
        return Err(busy());
    }
    if response.status != 200 {
        return Err(unavailable());
    }
    let Some(Value::Array(blocks)) = body.as_ref().and_then(|v| v.get("content")) else {
        return Err(could_not_plan());
    };
    let mut text = String::new();
    for block in blocks {
        if block.get("type").and_then(Value::as_str) == Some("text")
            && let Some(piece) = block.get("text").and_then(Value::as_str)
        {
            text.push_str(piece);
        }
    }
    if text.is_empty() {
        return Err(could_not_plan());
    }
    Ok(text)
}

fn unpack_openai(response: &HttpResponse) -> Result<String, ProviderError> {
    let body = parse_json(&response.body);
    if response.status == 401 {
        return Err(ProviderError::InvalidKey);
    }
    let code = body
        .as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("code"))
        .and_then(Value::as_str);
    match code {
        Some("credit_balance_exhausted")
        | Some("organization_spend_limit_exceeded")
        | Some("project_spend_limit_exceeded")
        | Some("organization_usage_limit_exceeded")
        | Some("insufficient_quota") => return Err(ProviderError::OutOfCredit),
        _ => {}
    }
    if response.status == 429 {
        return match code {
            Some("rate_limit_exceeded") | Some("slow_down") | None => Err(busy()),
            _ => Err(ProviderError::OutOfCredit),
        };
    }
    if response.status != 200 {
        return Err(unavailable());
    }
    body.as_ref()
        .and_then(|v| v.get("choices"))
        .and_then(Value::as_array)
        .and_then(|c| c.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .ok_or_else(could_not_plan)
}

fn unpack_google(response: &HttpResponse) -> Result<String, ProviderError> {
    let body = parse_json(&response.body);
    let reason = google_reason(&body);
    let status = body
        .as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("status"))
        .and_then(Value::as_str);
    if reason == Some("API_KEY_INVALID")
        || (response.status == 400 && status == Some("INVALID_ARGUMENT") && reason.is_some())
        || message_says_bad_key(&body)
    {
        return Err(ProviderError::InvalidKey);
    }
    if response.status == 403 || status == Some("PERMISSION_DENIED") {
        return Err(ProviderError::InvalidKey);
    }
    if status == Some("FAILED_PRECONDITION") {
        return Err(ProviderError::OutOfCredit);
    }
    if response.status == 429 || status == Some("RESOURCE_EXHAUSTED") {
        return Err(ProviderError::Unavailable(
            "The Provider is busy, or this Key is out of credit. Try again, add credit, or pick another Provider."
                .to_string(),
        ));
    }
    if response.status != 200 {
        return Err(unavailable());
    }
    let mut text = String::new();
    if let Some(candidates) = body
        .as_ref()
        .and_then(|v| v.get("candidates"))
        .and_then(Value::as_array)
    {
        for candidate in candidates {
            if let Some(parts) = candidate
                .pointer("/content/parts")
                .and_then(Value::as_array)
            {
                for part in parts {
                    if let Some(piece) = part.get("text").and_then(Value::as_str) {
                        text.push_str(piece);
                    }
                }
            }
        }
    }
    if text.is_empty() {
        return Err(could_not_plan());
    }
    Ok(text)
}

fn parse_json(body: &str) -> Option<Value> {
    serde_json::from_str(body).ok()
}

fn type_is(body: &Option<Value>, expected: &str) -> bool {
    body.as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("type"))
        .and_then(Value::as_str)
        == Some(expected)
}

fn error_code(body: &Option<Value>) -> Option<&str> {
    body.as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("details"))
        .and_then(|d| d.get("error_code"))
        .and_then(Value::as_str)
}

fn google_reason(body: &Option<Value>) -> Option<&str> {
    body.as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("details"))
        .and_then(Value::as_array)
        .and_then(|details| {
            details
                .iter()
                .find_map(|d| d.get("reason").and_then(Value::as_str))
        })
}

fn message_says_bad_key(body: &Option<Value>) -> bool {
    body.as_ref()
        .and_then(|v| v.get("error"))
        .and_then(|e| e.get("message"))
        .and_then(Value::as_str)
        .is_some_and(|m| m.to_ascii_lowercase().contains("api key not valid"))
}

fn header<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

fn unavailable() -> ProviderError {
    ProviderError::Unavailable(
        "The Provider refused the request. Try again, or pick another Provider.".to_string(),
    )
}

fn busy() -> ProviderError {
    ProviderError::Unavailable("The Provider is busy. Try again in a moment.".to_string())
}

fn could_not_plan() -> ProviderError {
    ProviderError::Unavailable(
        "The Agent could not plan that. Try again, or pick another Provider.".to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn creds(provider: ProviderName) -> Credentials {
        Credentials {
            provider,
            key: "sk-test".to_string(),
        }
    }

    #[test]
    fn every_lab_carries_the_same_verb_contract() {
        for provider in ProviderName::ALL {
            let request = pack(&creds(provider), "a lighthouse at dusk");
            assert!(
                request.body.contains("The Person never names a Verb"),
                "{provider:?} must carry Tessera's Verb contract, not its own"
            );
            for verb in [
                "place", "frame", "light", "sky", "wear", "carve", "inflate", "taper", "weather",
            ] {
                assert!(
                    request.body.contains(verb),
                    "{provider:?} must name the Verb {verb} in the shared contract"
                );
            }
            for part in ["lantern room", "cliff slab", "railing"] {
                assert!(
                    request.body.contains(part),
                    "{provider:?} must name Kit Part {part} in the shared contract"
                );
            }
        }
    }

    #[test]
    fn the_three_labs_use_their_own_envelopes() {
        let anthropic = pack(&creds(ProviderName::Anthropic), "hi");
        assert_eq!(anthropic.url, "https://api.anthropic.com/v1/messages");
        assert!(
            anthropic
                .headers
                .iter()
                .any(|(k, v)| k == "x-api-key" && v == "sk-test")
        );
        assert!(
            anthropic
                .headers
                .iter()
                .any(|(k, v)| k == "anthropic-version" && v == "2023-06-01")
        );

        let openai = pack(&creds(ProviderName::OpenAI), "hi");
        assert_eq!(openai.url, "https://api.openai.com/v1/chat/completions");
        assert!(
            openai
                .headers
                .iter()
                .any(|(k, v)| k == "authorization" && v == "Bearer sk-test")
        );

        let google = pack(&creds(ProviderName::Google), "hi");
        assert!(
            google
                .url
                .starts_with("https://generativelanguage.googleapis.com/"),
            "{}",
            google.url
        );
        assert!(google.url.contains(":generateContent"), "{}", google.url);
        assert!(
            google
                .headers
                .iter()
                .any(|(k, v)| k == "x-goog-api-key" && v == "sk-test")
        );
    }
}
