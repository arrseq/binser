extern crate xbinser;
extern crate xbinser_macros;

use std::io::{Cursor, Seek};
use std::time::Instant;
use xbinser::encoding::{Decoded, Encoded};
use xbinser_macros::{EnumDecoded, EnumEncoded, StructDecoded, StructEncoded};

#[derive(Debug, StructEncoded, StructDecoded, PartialEq)]
struct TextContainer {
    text: Vec<u8>,
    inner: Vec<u8>,
    hi: [u8; 2]
}

fn main() {
    let mut cursor = Cursor::new(vec![]);
    let container = TextContainer { 
        // text: vec![200; 4 * 1080 * 1920],
        text: vec![1, 2, 3],
        inner: vec![4, 5, 6],
        hi: [1, 7]
    };
    container.encode(&mut cursor).unwrap();
    cursor.set_position(0);

    let start = Instant::now();
    dbg!(TextContainer::decode(&mut cursor));
    println!("Encoded data in {:?}", start.elapsed());
}