use std::io;

pub trait Encoded {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()>;
}

pub trait Decoded: Sized {
    fn decode(input: &mut impl io::Read) -> io::Result<Self>;
}

impl Encoded for bool {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let byte = if *self { 1 } else { 0 };
        output.write_all(&[byte])
    }
}

impl Decoded for bool {
    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut byte = [0];
        input.read_exact(&mut byte)?;
        Ok(byte[0] != 0)
    }
}

macro_rules! implement_int_trait {
    ($int:ident) => {
        impl Encoded for $int {
            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                let bytes = self.to_le_bytes();
                output.write_all(&bytes)
            }
        }
        
        impl Decoded for $int {
            fn decode(input: &mut impl io::Read) -> io::Result<Self> {
                let mut bytes = [0; std::mem::size_of::<$int>()];
                input.read_exact(&mut bytes)?;
                Ok($int::from_le_bytes(bytes))
            }
        }
    };
}

implement_int_trait!(u8);
implement_int_trait!(u16);
implement_int_trait!(u32);
implement_int_trait!(u64);
implement_int_trait!(i8);
implement_int_trait!(i16);
implement_int_trait!(i32);
implement_int_trait!(i64);

impl<T: Encoded, const N: usize> Encoded for [T; N] {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        for item in self.iter() { item.encode(output)?; }
        Ok(())
    }
}

impl<T: Decoded, const N: usize> Decoded for [T; N] {
    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut array: [T; N] = unsafe { std::mem::MaybeUninit::uninit().assume_init() };
        for item in &mut array { *item = T::decode(input)?; }
        Ok(array)
    }
}

impl<T: Encoded> Encoded for Vec<T> {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let length = self.len() as u64;
        output.write_all(&length.to_le_bytes())?;

        for item in self.iter() {
            item.encode(output)?;
        }

        Ok(())
    }
}

impl<T: Decoded> Decoded for Vec<T> {
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
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let bytes = self.as_bytes();
        let length = bytes.len() as u64;

        output.write_all(&length.to_le_bytes())?;
        output.write_all(bytes)?;

        Ok(())
    }
}

impl Decoded for String {
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