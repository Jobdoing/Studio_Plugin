use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_name = studioCraftOpen)]
    fn open_js(purpose: &str) -> js_sys::Promise;
    #[wasm_bindgen(js_name = studioCraftSave)]
    fn save_js(name: &str, bytes: &js_sys::Uint8Array, document_id: &str, save_as: bool, copy: bool) -> js_sys::Promise;
    #[wasm_bindgen(js_name = studioCraftBind)]
    pub fn bind(document_id: &str, token: &str);
    #[wasm_bindgen(js_name = studioCraftDiscard)]
    pub fn discard(token: &str);
    #[wasm_bindgen(js_name = studioCraftForget)]
    pub fn forget(ids: &js_sys::Array);
    #[wasm_bindgen(js_name = studioCraftSaveMany)]
    fn save_many_js(files: &js_sys::Array) -> js_sys::Promise;
    #[wasm_bindgen(js_name = studioCraftDirty)]
    pub fn dirty(value: bool);
}

fn error(value: JsValue) -> String {
    js_sys::Reflect::get(&value, &"message".into())
        .ok()
        .and_then(|v| v.as_string())
        .unwrap_or_else(|| format!("{value:?}"))
}

pub async fn open(purpose: &str) -> Result<Option<(String, Vec<u8>)>, String> {
    let value = JsFuture::from(open_js(purpose)).await.map_err(error)?;
    if value.is_null() {
        return Ok(None);
    }
    decode(value).map(Some)
}

fn decode(value: JsValue) -> Result<(String, Vec<u8>), String> {
    let name = js_sys::Reflect::get(&value, &"name".into())
        .map_err(error)?
        .as_string()
        .ok_or("INVALID_NAME")?;
    let bytes = js_sys::Reflect::get(&value, &"bytes".into()).map_err(error)?;
    Ok((name, js_sys::Uint8Array::new(&bytes).to_vec()))
}

pub async fn open_many(purpose: &str) -> Result<Vec<(String, Vec<u8>)>, String> {
    let value = JsFuture::from(open_js(&format!("{purpose}:multiple")))
        .await
        .map_err(error)?;
    if value.is_null() {
        return Ok(Vec::new());
    }
    js_sys::Array::from(&value).iter().map(decode).collect()
}

pub async fn open_document(purpose: &str) -> Result<Option<(String, Vec<u8>, String)>, String> {
    let value = JsFuture::from(open_js(&format!("{purpose}:single:document"))).await.map_err(error)?;
    if value.is_null() { return Ok(None); }
    let token = js_sys::Reflect::get(&value, &"sourceToken".into()).map_err(error)?.as_string().ok_or("INVALID_SOURCE")?;
    let (name, bytes) = decode(value)?;
    Ok(Some((name, bytes, token)))
}

pub async fn open_documents(purpose: &str) -> Result<Vec<(String, Vec<u8>, String)>, String> {
    let value = JsFuture::from(open_js(&format!("{purpose}:multiple:document"))).await.map_err(error)?;
    if value.is_null() { return Ok(Vec::new()); }
    js_sys::Array::from(&value).iter().map(|value| {
        let token = js_sys::Reflect::get(&value, &"sourceToken".into()).map_err(error)?.as_string().ok_or("INVALID_SOURCE")?;
        let (name, bytes) = decode(value)?;
        Ok((name, bytes, token))
    }).collect()
}

pub async fn save(name: &str, bytes: &[u8]) -> Result<(), String> {
    save_document("", name, bytes, true, true).await.map(|_| ())
}

pub async fn save_named(name: &str, bytes: &[u8]) -> Result<String, String> {
    save_document("", name, bytes, true, true).await
}

pub async fn save_document(document_id: &str, name: &str, bytes: &[u8], save_as: bool, copy: bool) -> Result<String, String> {
    let receipt = JsFuture::from(save_js(name, &js_sys::Uint8Array::from(bytes), document_id, save_as, copy))
        .await
        .map_err(error)?;
    if js_sys::Reflect::get(&receipt, &"status".into()).map_err(error)?.as_string().as_deref() != Some("saved") {
        return Err("SAVE_NOT_CONFIRMED".into());
    }
    js_sys::Reflect::get(&receipt, &"filename".into())
        .map_err(error)?
        .as_string()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Studio upload returned no filename".to_owned())
}

pub async fn save_many(files: &[(String, std::sync::Arc<Vec<u8>>)]) -> Result<(), String> {
    let values = js_sys::Array::new();
    for (name, bytes) in files {
        let file = js_sys::Object::new();
        js_sys::Reflect::set(&file, &"name".into(), &name.as_str().into()).map_err(error)?;
        js_sys::Reflect::set(
            &file,
            &"bytes".into(),
            &js_sys::Uint8Array::from(bytes.as_slice()),
        )
        .map_err(error)?;
        values.push(&file);
    }
    JsFuture::from(save_many_js(&values)).await.map_err(error)?;
    Ok(())
}
