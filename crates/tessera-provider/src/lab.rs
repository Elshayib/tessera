//! Per-lab HTTP dialects. The Verb contract and the system prompt are shared;
//! only the envelope (URL, headers, JSON wrap) changes.

use serde_json::{Value, json};
use tessera_session::{
    Bindings, Brain, BrainKind, Credentials, Intent, Picture, ProviderError, ProviderName,
    chat_brains,
};

use crate::prompt::SYSTEM;
use crate::transport::{HttpRequest, HttpResponse};

fn thinking_brain(credentials: &Credentials) -> &str {
    credentials
        .brain
        .as_deref()
        .expect("chat names a Brain; Session resolves one before thinking")
}

/// Pack Intent + Scene bindings + the shared Verb contract into the chosen lab's POST.
pub fn pack(credentials: &Credentials, intent: &Intent, bindings: Bindings<'_>) -> HttpRequest {
    let text = user_content(intent, bindings);
    let brain = thinking_brain(credentials);
    match credentials.provider {
        ProviderName::Anthropic => HttpRequest {
            url: "https://api.anthropic.com/v1/messages".to_string(),
            headers: vec![
                ("content-type".into(), "application/json".into()),
                ("x-api-key".into(), credentials.key.clone()),
                ("anthropic-version".into(), "2023-06-01".into()),
            ],
            body: json!({
                "model": brain,
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
                "model": brain,
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
                "https://generativelanguage.googleapis.com/v1beta/models/{brain}:generateContent"
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

/// List what this Provider currently offers. Each lab is a live GET; Tessera
/// does not pin a SKU.
pub fn list_brains<T: crate::transport::Transport>(
    transport: &mut T,
    credentials: &Credentials,
) -> Result<Vec<Brain>, ProviderError> {
    match credentials.provider {
        ProviderName::Anthropic => list_anthropic(transport, &credentials.key),
        ProviderName::OpenAI => list_openai(transport, &credentials.key),
        ProviderName::Google => list_google(transport, &credentials.key),
    }
}

fn list_anthropic<T: crate::transport::Transport>(
    transport: &mut T,
    key: &str,
) -> Result<Vec<Brain>, ProviderError> {
    let mut brains = Vec::new();
    let mut after_id: Option<String> = None;
    loop {
        let mut url = "https://api.anthropic.com/v1/models?limit=1000".to_string();
        if let Some(id) = &after_id {
            url.push_str("&after_id=");
            url.push_str(id);
        }
        let request = HttpRequest {
            url,
            headers: vec![
                ("x-api-key".into(), key.to_string()),
                ("anthropic-version".into(), "2023-06-01".into()),
            ],
            body: String::new(),
        };
        let response = transport.get(&request).map_err(|_| {
            ProviderError::Unavailable(
                "Could not reach the Provider. Check the network and try again.".to_string(),
            )
        })?;
        if let Some(err) = anthropic_refusal(&response) {
            return Err(err);
        }
        let (page, has_more, last_id) = anthropic_catalog_page(&response.body)?;
        brains.extend(page);
        if has_more {
            let Some(last_id) = last_id else {
                break;
            };
            after_id = Some(last_id);
            continue;
        }
        break;
    }
    Ok(chat_brains(brains))
}

fn list_openai<T: crate::transport::Transport>(
    transport: &mut T,
    key: &str,
) -> Result<Vec<Brain>, ProviderError> {
    let request = HttpRequest {
        url: "https://api.openai.com/v1/models".to_string(),
        headers: vec![("authorization".into(), format!("Bearer {key}"))],
        body: String::new(),
    };
    let response = transport.get(&request).map_err(|_| {
        ProviderError::Unavailable(
            "Could not reach the Provider. Check the network and try again.".to_string(),
        )
    })?;
    if let Some(err) = openai_refusal(&response) {
        return Err(err);
    }
    Ok(chat_brains(openai_catalog(&response.body)?))
}

fn openai_catalog(body: &str) -> Result<Vec<Brain>, ProviderError> {
    let value = parse_json(body).ok_or_else(could_not_list)?;
    let Some(serde_json::Value::Array(data)) = value.get("data").cloned() else {
        return Err(could_not_list());
    };
    let mut brains = Vec::new();
    for item in data {
        let Some(id) = item.get("id").and_then(serde_json::Value::as_str) else {
            continue;
        };
        if id.is_empty() {
            continue;
        }
        brains.push(Brain {
            id: id.to_string(),
            name: id.to_string(),
            can_see: true,
            price: None,
            kind: openai_kind(id),
        });
    }
    Ok(brains)
}

/// OpenAI's list does not name modalities. Drop offerings whose id is
/// embeddings, image-gen, audio, or other non-chat work.
fn openai_kind(id: &str) -> BrainKind {
    let id = id.to_ascii_lowercase();
    let stem = id
        .strip_prefix("ft:")
        .and_then(|s| s.split(':').next())
        .unwrap_or(&id);
    if stem.contains("embedding") {
        BrainKind::Embeddings
    } else if stem.contains("dall-e") || stem.contains("dalle") || stem.contains("gpt-image") {
        BrainKind::ImageGen
    } else if stem.contains("whisper")
        || stem.contains("tts")
        || stem.contains("transcribe")
        || stem.contains("realtime")
        || stem.contains("audio")
    {
        BrainKind::Audio
    } else if stem.contains("moderation")
        || stem.contains("sora")
        || stem.contains("computer-use")
        || stem.contains("instruct")
        || stem.starts_with("davinci")
        || stem.starts_with("babbage")
    {
        BrainKind::Other
    } else {
        BrainKind::Chat
    }
}

fn list_google<T: crate::transport::Transport>(
    transport: &mut T,
    key: &str,
) -> Result<Vec<Brain>, ProviderError> {
    let mut brains = Vec::new();
    let mut page_token: Option<String> = None;
    loop {
        let mut url =
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000".to_string();
        if let Some(token) = &page_token {
            url.push_str("&pageToken=");
            url.push_str(token);
        }
        let request = HttpRequest {
            url,
            headers: vec![("x-goog-api-key".into(), key.to_string())],
            body: String::new(),
        };
        let response = transport.get(&request).map_err(|_| {
            ProviderError::Unavailable(
                "Could not reach the Provider. Check the network and try again.".to_string(),
            )
        })?;
        if let Some(err) = google_refusal(&response) {
            return Err(err);
        }
        let (page, next) = google_catalog_page(&response.body)?;
        brains.extend(page);
        match next {
            Some(token) if !token.is_empty() => page_token = Some(token),
            _ => break,
        }
    }
    Ok(chat_brains(brains))
}

fn google_catalog_page(body: &str) -> Result<(Vec<Brain>, Option<String>), ProviderError> {
    let value = parse_json(body).ok_or_else(could_not_list)?;
    let Some(serde_json::Value::Array(models)) = value.get("models").cloned() else {
        return Err(could_not_list());
    };
    let mut brains = Vec::new();
    for item in models {
        let Some(name) = item.get("name").and_then(serde_json::Value::as_str) else {
            continue;
        };
        if name.is_empty() {
            continue;
        }
        let id = name.strip_prefix("models/").unwrap_or(name);
        if id.is_empty() {
            continue;
        }
        let display = item
            .get("displayName")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(id);
        let methods = item
            .get("supportedGenerationMethods")
            .and_then(Value::as_array);
        brains.push(Brain {
            id: id.to_string(),
            name: display.to_string(),
            can_see: true,
            price: None,
            kind: google_kind(methods),
        });
    }
    let next = value
        .get("nextPageToken")
        .and_then(serde_json::Value::as_str)
        .filter(|t| !t.is_empty())
        .map(str::to_string);
    Ok((brains, next))
}

fn google_kind(methods: Option<&Vec<Value>>) -> BrainKind {
    let Some(methods) = methods else {
        return BrainKind::Chat;
    };
    let names: Vec<&str> = methods.iter().filter_map(Value::as_str).collect();
    if names.is_empty() {
        return BrainKind::Chat;
    }
    if names.contains(&"generateContent") {
        BrainKind::Chat
    } else if names.contains(&"embedContent") {
        BrainKind::Embeddings
    } else if names.contains(&"predict")
        || names.contains(&"generateImages")
        || names.iter().any(|m| m.contains("Image"))
    {
        BrainKind::ImageGen
    } else {
        BrainKind::Other
    }
}

fn anthropic_catalog_page(body: &str) -> Result<(Vec<Brain>, bool, Option<String>), ProviderError> {
    let value = parse_json(body).ok_or_else(could_not_list)?;
    let Some(serde_json::Value::Array(data)) = value.get("data").cloned() else {
        return Err(could_not_list());
    };
    let mut brains = Vec::new();
    for item in data {
        let Some(id) = item.get("id").and_then(serde_json::Value::as_str) else {
            continue;
        };
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("display_name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(id);
        let can_see = item
            .pointer("/capabilities/image_input/supported")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true);
        brains.push(Brain {
            id: id.to_string(),
            name: name.to_string(),
            can_see,
            price: None,
            kind: BrainKind::Chat,
        });
    }
    let has_more = value
        .get("has_more")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let last_id = value
        .get("last_id")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    Ok((brains, has_more, last_id))
}

fn could_not_list() -> ProviderError {
    ProviderError::Unavailable(
        "The Provider did not return a list of Brains. Try again, or pick another Provider."
            .to_string(),
    )
}

fn anthropic_refusal(response: &HttpResponse) -> Option<ProviderError> {
    let body = parse_json(&response.body);
    if response.status == 401
        || type_is(&body, "authentication_error")
        || type_is(&body, "permission_error")
    {
        return Some(ProviderError::InvalidKey);
    }
    if response.status == 402
        || type_is(&body, "billing_error")
        || error_code(&body) == Some("enforced_spend_limit_reached")
    {
        return Some(ProviderError::OutOfCredit);
    }
    if response.status == 429 {
        let retry = header(&response.headers, "retry-after");
        if retry.is_none() || error_code(&body) == Some("enforced_spend_limit_reached") {
            return Some(ProviderError::OutOfCredit);
        }
        return Some(busy());
    }
    if response.status != 200 {
        return Some(unavailable());
    }
    None
}

fn unpack_anthropic(response: &HttpResponse) -> Result<String, ProviderError> {
    if let Some(err) = anthropic_refusal(response) {
        return Err(err);
    }
    let body = parse_json(&response.body);
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

fn openai_refusal(response: &HttpResponse) -> Option<ProviderError> {
    let body = parse_json(&response.body);
    if response.status == 401 {
        return Some(ProviderError::InvalidKey);
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
        | Some("insufficient_quota") => return Some(ProviderError::OutOfCredit),
        _ => {}
    }
    if response.status == 429 {
        return Some(match code {
            Some("rate_limit_exceeded") | Some("slow_down") | None => busy(),
            _ => ProviderError::OutOfCredit,
        });
    }
    if response.status != 200 {
        return Some(unavailable());
    }
    None
}

fn unpack_openai(response: &HttpResponse) -> Result<String, ProviderError> {
    if let Some(err) = openai_refusal(response) {
        return Err(err);
    }
    parse_json(&response.body)
        .as_ref()
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

fn google_refusal(response: &HttpResponse) -> Option<ProviderError> {
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
        return Some(ProviderError::InvalidKey);
    }
    if response.status == 403 || status == Some("PERMISSION_DENIED") {
        return Some(ProviderError::InvalidKey);
    }
    if status == Some("FAILED_PRECONDITION") {
        return Some(ProviderError::OutOfCredit);
    }
    if response.status == 429 || status == Some("RESOURCE_EXHAUSTED") {
        return Some(ProviderError::Unavailable(
            "The Provider is busy, or this Key is out of credit. Try again, add credit, or pick another Provider."
                .to_string(),
        ));
    }
    if response.status != 200 {
        return Some(unavailable());
    }
    None
}

fn unpack_google(response: &HttpResponse) -> Result<String, ProviderError> {
    if let Some(err) = google_refusal(response) {
        return Err(err);
    }
    let body = parse_json(&response.body);
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
            brain: Some("test-brain".to_string()),
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
    fn anthropic_names_the_brain_id_not_a_pinned_sku() {
        let mut creds = creds(ProviderName::Anthropic);
        creds.brain = Some("claude-opus-4-1".into());
        let request = pack(&creds, &words("hi"), none_pointed());
        assert!(
            request.body.contains("claude-opus-4-1"),
            "the Agent thinks with the Brain the Person picked"
        );
        assert!(
            !request.body.contains("test-brain"),
            "a live pick must not be replaced by a stand-in id"
        );
    }

    #[test]
    fn openai_names_the_brain_id_not_a_pinned_sku() {
        let mut creds = creds(ProviderName::OpenAI);
        creds.brain = Some("gpt-4.1-mini".into());
        let request = pack(&creds, &words("hi"), none_pointed());
        assert!(
            request.body.contains("gpt-4.1-mini"),
            "the Agent thinks with the Brain the Person picked"
        );
        assert!(
            !request.body.contains("gpt-4.1-nano"),
            "a live pick must not be replaced by a pinned SKU"
        );
    }

    #[test]
    fn google_names_the_brain_id_not_a_pinned_sku() {
        let mut creds = creds(ProviderName::Google);
        creds.brain = Some("gemini-2.5-pro".into());
        let request = pack(&creds, &words("hi"), none_pointed());
        assert!(
            request.url.contains("gemini-2.5-pro"),
            "the Agent thinks with the Brain the Person picked: {}",
            request.url
        );
        assert!(
            !request.url.contains("gemini-2.5-flash"),
            "a live pick must not be replaced by a pinned SKU: {}",
            request.url
        );
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
