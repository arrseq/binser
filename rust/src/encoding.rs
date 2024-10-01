use std::io;
use std::io::{ErrorKind, Read};
use std::ops::{Deref, DerefMut};
use bytemuck::{cast_slice, try_cast_slice, NoUninit};

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
    ($ty: ident) => {
        impl Encoded for $ty {
            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                let bytes = self.to_le_bytes();
                output.write_all(&bytes)
            }
        }
        
        impl<const N: usize> Encoded for [$ty; N] {
            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                output.write_all(&self.len().to_le_bytes())?;
                output.write_all(cast_slice(self))
            }
        }
        
        impl<const N: usize> Decoded for [$ty; N] {
            fn decode(input: &mut impl io::Read) -> io::Result<Self> {
                let mut array: [u8; N] = unsafe { std::mem::MaybeUninit::uninit().assume_init() };
                input.read_exact(&mut array)?;
                let casted = bytemuck::try_cast(array).map_err(|error| io::Error::new(ErrorKind::InvalidData, error))?;
                Ok(casted)
            }
        }
        
        impl Decoded for $ty {
            fn decode(input: &mut impl io::Read) -> io::Result<Self> {
                let mut bytes = [0; std::mem::size_of::<$ty>()];
                input.read_exact(&mut bytes)?;
                Ok($ty::from_le_bytes(bytes))
            }
        }
        
        impl Encoded for &[$ty] {
            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                output.write_all(&self.len().to_le_bytes())?;
                output.write_all(cast_slice(self))
            }
        }
        impl Encoded for Vec<$ty> {
            fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
                (self as &[$ty]).encode(output)
            }
        }

        impl Decoded for Vec<$ty> {
            fn decode(input: &mut impl io::Read) -> io::Result<Self> {
                let length = {
                    let mut buffer = [0u8; size_of::<u64>()];
                    input.read_exact(&mut buffer)?;
                    u64::from_le_bytes(buffer) as usize
                };

                let mut vec = vec![0u8; length];
                input.read_exact(vec.deref_mut())?;
                let slice = try_cast_slice(vec.deref()).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
                Ok(Vec::from(slice))
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

impl<T: Encoded + SlowType, const N: usize> Encoded for [T; N] {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        for item in self.iter() { item.encode(output)?; }
        Ok(())
    }
}

impl<T: Decoded + SlowType, const N: usize> Decoded for [T; N] {
    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let mut array: [T; N] = unsafe { std::mem::MaybeUninit::uninit().assume_init() };
        for item in &mut array { *item = T::decode(input)?; }
        Ok(array)
    }
}

pub trait SlowType {}
impl<T> SlowType for Vec<T> {}
impl<T> SlowType for &[T] {}
impl SlowType for &str {}

impl<T: Encoded + SlowType> Encoded for &[T] {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let length = self.len() as u64;
        output.write_all(&length.to_le_bytes())?;

        for item in self.iter() {
            item.encode(output)?;
        }

        Ok(())
    }
}
impl<T: Encoded + SlowType> Encoded for Vec<T> {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        let slice: &[T] = self;
        slice.encode(output)
    }
}

impl<T: Decoded + SlowType> Decoded for Vec<T> {
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

impl Encoded for &str {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        self.as_bytes().encode(output)
    }
}
impl Encoded for String {
    fn encode(&self, output: &mut impl io::Write) -> io::Result<()> {
        (self as &str).encode(output)
    }
}

impl Decoded for String {
    fn decode(input: &mut impl io::Read) -> io::Result<Self> {
        let bytes = Vec::<u8>::decode(input)?;
        String::from_utf8(bytes)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }
}