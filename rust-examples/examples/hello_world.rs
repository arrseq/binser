extern crate binser;
extern crate binser_macros;

use std::io::Cursor;
use binser::encoding::{Decoded, Encoded};
use binser_macros::{EnumDecoded, EnumEncoded, StructDecoded, StructEncoded};

#[derive(Debug, EnumDecoded)]
enum En {
    A { r#virtual: bool, b: u8 }, B
}

#[derive(Debug, StructDecoded)]
struct TestStruct {
    e: En,
    som: u8
}

fn main() {
    let s = TestStruct {
        e: En::A { r#virtual: true, b: 50 },
        som: 50
    };

    let mut out = Cursor::new(vec![0, 1, 15, 23]);
    dbg!(TestStruct::decode(&mut out));

    // dbg!(out.get_ref());
}