extern crate xbinser;
extern crate xbinser_macros;

use std::io::{Cursor, Seek};
use std::time::Instant;
use xbinser::encoding::{Decoded, Encoded};
use xbinser_macros::{EnumDecoded, EnumEncoded, StructDecoded, StructEncoded};

#[derive(Debug, StructEncoded, StructDecoded, PartialEq)]
struct TextContainer {
    text: Vec<u16>,
    inner: Vec<Vec<u8>>
}

fn main() {
    let mut cursor = Cursor::new(vec![]);
    let container = TextContainer { 
        // text: vec![200; 4 * 1080 * 1920],
        text: vec![],
        inner: vec![ vec![ 1, 2, 3 ], vec![4, 5, 6] ]
    };
    container.encode(&mut cursor).unwrap();
    cursor.set_position(0);

    let start = Instant::now();
    dbg!(TextContainer::decode(&mut cursor));
    println!("Encoded data in {:?}", start.elapsed());
}