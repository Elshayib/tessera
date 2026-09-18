//! Per-lab HTTP dialects. The Verb contract and the system prompt are shared;
//! only the envelope (URL, headers, JSON wrap) changes.

use serde_json::{Value, json};
use tessera_session::{Bindings, Credentials, Intent, Picture, ProviderError, ProviderName};

use crate::prompt::SYSTEM;
use crate::transport::{HttpRequest, HttpResponse};

const ANTHROPIC_MODEL: &str = "claude-haiku-4-5";
const OPENAI_MODEL: &str = "gpt-4.1-nano";
const GOOGLE_MODEL: &str = "gemini-2.5-flash";

/// Pack Intent + Scene bindings + the shared Verb contract into the chosen lab's POST.
pub fn pack(credentials: &Credentials, intent: &Intent, bindings: Bindings<'_>) -> HttpRequest {
    let text = user_content(intent, bindings);
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
                "messages": [{ "role": "user", "content": anthropic_content(&text, intent.pictures()) }],
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
                    { "role": "user", "content": openai_content(&text, intent.pictures()) },
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
                    "parts": google_parts(&text, intent.pictures()),
                }],
                "generationConfig": { "maxOutputTokens": 4096 },
            })
            .to_string(),
        },
    }
}

fn user_content(intent: &Intent, bindings: Bindings<'_>) -> String {
    let objects = if bindings.objects.is_empty() {
        "(none yet)".to_string()
    } else {
        bindings.objects.join(", ")
    };
    let pointed = bindings.pointed.unwrap_or("(none)");
    let mut text = format!(
        "{}\n\nObjects in the Scene: {objects}\nPointed: {pointed}",
        intent.words
    );
    if let Some(ask) = bindings.pending_ask {
        text.push_str("\nPending Ask: ");
        text.push_str(ask);
    }
    if !intent.pictures().is_empty() {
        let kinds: Vec<&str> = intent.pictures().iter().map(|p| p.kind().word()).collect();
        text.push_str("\nPictures dropped: ");
        text.push_str(&kinds.join(", "));
        text.push_str(". Pictures are Intent, not a scan to copy.");
    }
    text
}

fn anthropic_content(text: &str, pictures: &[Picture]) -> Value {
    if pictures.is_empty() {
        return Value::String(text.to_string());
    }
    let mut blocks = vec![json!({ "type": "text", "text": text })];
    for picture in pictures {
        let (media_type, data) = encode_picture(picture);
        blocks.push(json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": data,
            }
        }));
    }
    Value::Array(blocks)
}

fn openai_content(text: &str, pictures: &[Picture]) -> Value {
    if pictures.is_empty() {
        return Value::String(text.to_string());
    }
    let mut parts = vec![json!({ "type": "text", "text": text })];
    for picture in pictures {
        let (media_type, data) = encode_picture(picture);
        parts.push(json!({
            "type": "image_url",
            "image_url": { "url": format!("data:{media_type};base64,{data}") }
        }));
    }
    Value::Array(parts)
}

fn google_parts(text: &str, pictures: &[Picture]) -> Value {
    let mut parts = vec![json!({ "text": text })];
    for picture in pictures {
        let (media_type, data) = encode_picture(picture);
        parts.push(json!({
            "inline_data": {
                "mime_type": media_type,
                "data": data,
            }
        }));
    }
    Value::Array(parts)
}

fn encode_picture(picture: &Picture) -> (&'static str, String) {
    (media_type(picture.bytes()), base64_encode(picture.bytes()))
}

fn media_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8 {
        "image/jpeg"
    } else {
        "image/png"
    }
}

fn base64_encode(input: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    let mut chunks = input.chunks_exact(3);
    for chunk in chunks.by_ref() {
        let n = (u32::from(chunk[0]) << 16) | (u32::from(chunk[1]) << 8) | u32::from(chunk[2]);
        out.push(T[(n >> 18) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(T[((n >> 6) & 63) as usize] as char);
        out.push(T[(n & 63) as usize] as char);
    }
    let rem = chunks.remainder();
    if rem.len() == 1 {
        let n = u32::from(rem[0]) << 16;
        out.push(T[(n >> 18) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push('=');
        out.push('=');
    } else if rem.len() == 2 {
        let n = (u32::from(rem[0]) << 16) | (u32::from(rem[1]) << 8);
        out.push(T[(n >> 18) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(T[((n >> 6) & 63) as usize] as char);
        out.push('=');
    }
    out
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

    fn none_pointed() -> Bindings<'static> {
        Bindings {
            objects: &[],
            pointed: None,
            pending_ask: None,
        }
    }

    fn words(text: &str) -> Intent {
        Intent::words(text)
    }

    #[test]
    fn every_lab_carries_the_same_verb_contract() {
        for provider in ProviderName::ALL {
            let request = pack(
                &creds(provider),
                &words("a lighthouse at dusk"),
                none_pointed(),
            );
            assert!(
                request.body.contains("The Person never names a Verb"),
                "{provider:?} must carry Tessera's Verb contract, not its own"
            );
            for verb in [
                "place", "frame", "light", "sky", "wear", "carve", "inflate", "taper", "weather",
                "remove",
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
            assert!(
                request.body.contains("Guess") && request.body.contains("Ask"),
                "{provider:?} must teach Guess-by-default and Ask as the exception"
            );
            assert!(
                request.body.contains("Pictures are Intent"),
                "{provider:?} must teach that pictures are Intent, not a generator"
            );
        }
    }

    #[test]
    fn every_lab_carries_named_objects_and_point() {
        let objects = ["the lantern roof".to_string(), "the shed roof".to_string()];
        let bindings = Bindings {
            objects: &objects,
            pointed: Some("the lantern roof"),
            pending_ask: None,
        };
        for provider in ProviderName::ALL {
            let request = pack(&creds(provider), &words("the roof is too steep"), bindings);
            assert!(
                request.body.contains("the lantern roof") && request.body.contains("the shed roof"),
                "{provider:?} must name the Scene's Objects"
            );
            assert!(
                request.body.contains("Pointed"),
                "{provider:?} must say what the Person Pointed at"
            );
        }
    }

    #[test]
    fn the_three_labs_use_their_own_envelopes() {
        let anthropic = pack(
            &creds(ProviderName::Anthropic),
            &words("hi"),
            none_pointed(),
        );
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

        let openai = pack(&creds(ProviderName::OpenAI), &words("hi"), none_pointed());
        assert_eq!(openai.url, "https://api.openai.com/v1/chat/completions");
        assert!(
            openai
                .headers
                .iter()
                .any(|(k, v)| k == "authorization" && v == "Bearer sk-test")
        );

        let google = pack(&creds(ProviderName::Google), &words("hi"), none_pointed());
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

    /// Pictures travel with Intent into every lab envelope (issue #9).
    /// `c2tldGNoLWJ5dGVz` is the base64 of the literal `sketch-bytes`.
    #[test]
    fn every_lab_carries_pictures_with_intent() {
        let intent = Intent::words("a lighthouse at dusk")
            .with_pictures([tessera_session::Picture::sketch(b"sketch-bytes".to_vec())]);
        for provider in ProviderName::ALL {
            let request = pack(&creds(provider), &intent, none_pointed());
            assert!(
                request.body.contains("c2tldGNoLWJ5dGVz"),
                "{provider:?} must send the picture bytes with Intent"
            );
            assert!(
                request.body.contains("sketch"),
                "{provider:?} must name the picture as a sketch"
            );
            assert!(
                request.body.contains("not a scan to copy"),
                "{provider:?} must say pictures are Intent, not a generator"
            );
        }
        let anthropic = pack(&creds(ProviderName::Anthropic), &intent, none_pointed());
        assert!(
            anthropic.body.contains("\"type\":\"image\"")
                || anthropic.body.contains("\"type\": \"image\""),
            "Anthropic must wrap the picture as an image block"
        );
        let openai = pack(&creds(ProviderName::OpenAI), &intent, none_pointed());
        assert!(
            openai.body.contains("image_url"),
            "OpenAI must wrap the picture as image_url"
        );
        let google = pack(&creds(ProviderName::Google), &intent, none_pointed());
        assert!(
            google.body.contains("inline_data"),
            "Google must wrap the picture as inline_data"
        );
    }
}
