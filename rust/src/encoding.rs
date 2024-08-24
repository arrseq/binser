use std::io;

pub enum Type {
    Bool,
    U8, U16, U32, U64,
    I8, I16, I32, I64,
    Array, Vector, String
}

pub trait Encoded: Sized {
    const TYPE: Type;
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()>;
    fn decode(input: &mut impl io::Read) -> io::Result<Self>;
}

impl Encoded for bool {
    const TYPE: Type = Type::Bool;

    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let byte = if *self { 1 } else { 0 };
        output.write_all(&[byte])
    }

    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut byte = [0];
        input.read_exact(&mut byte)?;
        Ok(byte[0] != 0)
    }
}

macro_rules! implement_int_trait {
    ($int:ident, $type:expr) => {
        impl Encoded for $int {
            const TYPE: Type = $type;

            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                let bytes = self.to_le_bytes();
                output.write_all(&bytes)
            }

            fn decode(input: &mut impl io::Read) -> io::Result<Self> {
                let mut bytes = [0; std::mem::size_of::<$int>()];
                input.read_exact(&mut bytes)?;
                Ok($int::from_le_bytes(bytes))
            }
        }
    };
}

implement_int_trait!(u8, Type::U8);
implement_int_trait!(u16, Type::U16);
implement_int_trait!(u32, Type::U32);
implement_int_trait!(u64, Type::U64);
implement_int_trait!(i8, Type::I8);
implement_int_trait!(i16, Type::I16);
implement_int_trait!(i32, Type::I32);
implement_int_trait!(i64, Type::I64);

impl<T: Encoded, const N: usize> Encoded for [T; N] {
    const TYPE: Type = Type::Array;

    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        for item in self.iter() { item.encode(output)?; }
        Ok(())
    }

    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut array: [T; N] = unsafe { std::mem::MaybeUninit::uninit().assume_init() };
        for item in &mut array { *item = T::decode(input)?; }
        Ok(array)
    }
}

impl<T: Encoded> Encoded for Vec<T> {
    const TYPE: Type = Type::Vector;

    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let length = self.len() as u64;
        output.write_all(&length.to_le_bytes())?;

        for item in self.iter() {
            item.encode(output)?;
        }

        Ok(())
    }

    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut length_bytes = [0u8; 8];
        input.read_exact(&mut length_bytes)?;
        let length = u64::from_le_bytes(length_bytes) as usize;

        let mut vec = Vec::with_capacity(length);

        for _ in 0..length {
            let item = T::decode(input)?;
            vec.push(item);
        }

        Ok(vec)
    }
}

impl Encoded for String {
    const TYPE: Type = Type::String;

    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let bytes = self.as_bytes();
        let length = bytes.len() as u64;

        output.write_all(&length.to_le_bytes())?;
        output.write_all(bytes)?;

        Ok(())
    }

    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut length_bytes = [0u8; 8];
        input.read_exact(&mut length_bytes)?;

        let length = u64::from_le_bytes(length_bytes) as usize;

        let mut string_bytes = vec![0u8; length];
        input.read_exact(&mut string_bytes)?;

        let decoded_string = String::from_utf8(string_bytes)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        Ok(decoded_string)
    }
}