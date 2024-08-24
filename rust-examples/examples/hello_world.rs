extern crate binser;
extern crate binser_macros;

use std::io::Cursor;
use binser::encoding::Encoded;
use binser_macros::{EnumEncoded, StructEncoded};

#[derive(EnumEncoded)]
enum En {
    A { r#virtual: bool, b: u8 }, B
}

#[derive(StructEncoded)]
struct TestStruct {
    e: En,
    som: u8
}

fn main() {
    let s = TestStruct {
        e: En::A { r#virtual: true, b: 50 },
        som: 50
    };

    let mut out = Cursor::new(vec![]);
    s.encode(&mut out);

    dbg!(out.get_ref());
}