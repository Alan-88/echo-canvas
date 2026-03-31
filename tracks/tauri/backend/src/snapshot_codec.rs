use serde::{de::DeserializeOwned, Serialize};

pub const WHITEBOARD_FILE_EXTENSION: &str = "whiteboard";
const WHITEBOARD_FILE_MAGIC: &str = "whiteboard-file";
const WHITEBOARD_FILE_VERSION: u16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotFormat {
    Json,
    MessagePack,
}

impl SnapshotFormat {
    pub fn from_env() -> Self {
        match std::env::var("ROOM_SNAPSHOT_FORMAT")
            .unwrap_or_else(|_| "json".to_string())
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "msgpack" | "messagepack" | "mpk" => SnapshotFormat::MessagePack,
            _ => SnapshotFormat::Json,
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            SnapshotFormat::Json => "json",
            SnapshotFormat::MessagePack => "msgpack",
        }
    }

    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_ascii_lowercase().as_str() {
            "json" => Some(SnapshotFormat::Json),
            "msgpack" => Some(SnapshotFormat::MessagePack),
            _ => None,
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WhiteboardFileEnvelope {
    magic: String,
    version: u16,
    snapshot_format: String,
    payload: Vec<u8>,
}

pub fn serialize_snapshot<T: Serialize>(
    value: &T,
    format: SnapshotFormat,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let bytes = match format {
        SnapshotFormat::Json => serde_json::to_vec_pretty(value)?,
        SnapshotFormat::MessagePack => rmp_serde::to_vec_named(value)?,
    };
    Ok(bytes)
}

pub fn deserialize_snapshot<T: DeserializeOwned>(
    bytes: &[u8],
    format: SnapshotFormat,
) -> Result<T, Box<dyn std::error::Error>> {
    let snapshot = match format {
        SnapshotFormat::Json => serde_json::from_slice(bytes)?,
        SnapshotFormat::MessagePack => rmp_serde::from_slice(bytes)?,
    };
    Ok(snapshot)
}

pub fn serialize_whiteboard_file<T: Serialize>(
    value: &T,
    format: SnapshotFormat,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let payload = serialize_snapshot(value, format)?;
    let envelope = WhiteboardFileEnvelope {
        magic: WHITEBOARD_FILE_MAGIC.to_string(),
        version: WHITEBOARD_FILE_VERSION,
        snapshot_format: format.extension().to_string(),
        payload,
    };
    Ok(rmp_serde::to_vec_named(&envelope)?)
}

pub fn deserialize_whiteboard_file<T: DeserializeOwned>(
    bytes: &[u8],
) -> Result<(T, SnapshotFormat), Box<dyn std::error::Error>> {
    let envelope: WhiteboardFileEnvelope = rmp_serde::from_slice(bytes)?;
    if envelope.magic != WHITEBOARD_FILE_MAGIC {
        return Err("invalid .whiteboard file magic".into());
    }
    if envelope.version != WHITEBOARD_FILE_VERSION {
        return Err(format!(
            "unsupported .whiteboard file version: {}",
            envelope.version
        )
        .into());
    }

    let format = SnapshotFormat::from_extension(&envelope.snapshot_format)
        .ok_or("unsupported embedded snapshot format")?;
    let snapshot = deserialize_snapshot::<T>(&envelope.payload, format)?;
    Ok((snapshot, format))
}

#[cfg(test)]
mod tests {
    use super::{
        deserialize_snapshot, deserialize_whiteboard_file, serialize_snapshot,
        serialize_whiteboard_file, SnapshotFormat, WHITEBOARD_FILE_EXTENSION,
    };
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Demo {
        id: u32,
        name: String,
        tags: Vec<String>,
    }

    fn sample() -> Demo {
        Demo {
            id: 7,
            name: "demo".to_string(),
            tags: vec!["a".to_string(), "b".to_string()],
        }
    }

    #[test]
    fn json_roundtrip() {
        let value = sample();
        let encoded = serialize_snapshot(&value, SnapshotFormat::Json).expect("json encode");
        let decoded: Demo =
            deserialize_snapshot(&encoded, SnapshotFormat::Json).expect("json decode");
        assert_eq!(decoded.id, value.id);
        assert_eq!(decoded.name, value.name);
        assert_eq!(decoded.tags, value.tags);
    }

    #[test]
    fn msgpack_roundtrip() {
        let value = sample();
        let encoded = serialize_snapshot(&value, SnapshotFormat::MessagePack).expect("mp encode");
        let decoded: Demo =
            deserialize_snapshot(&encoded, SnapshotFormat::MessagePack).expect("mp decode");
        assert_eq!(decoded.id, value.id);
        assert_eq!(decoded.name, value.name);
        assert_eq!(decoded.tags, value.tags);
    }

    #[test]
    fn whiteboard_file_roundtrip() {
        let value = sample();
        let encoded =
            serialize_whiteboard_file(&value, SnapshotFormat::MessagePack).expect("wb encode");
        let (decoded, embedded_format): (Demo, SnapshotFormat) =
            deserialize_whiteboard_file(&encoded).expect("wb decode");
        assert_eq!(embedded_format, SnapshotFormat::MessagePack);
        assert_eq!(decoded.id, value.id);
        assert_eq!(decoded.name, value.name);
        assert_eq!(decoded.tags, value.tags);
        assert_eq!(WHITEBOARD_FILE_EXTENSION, "whiteboard");
    }
}
