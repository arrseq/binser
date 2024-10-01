extern crate xbinser;
extern crate xbinser_macros;

use std::io::{Cursor, Seek};
use xbinser::encoding::{Decoded, Encoded};
use xbinser_macros::{EnumDecoded, EnumEncoded, StructDecoded, StructEncoded};

#[derive(Debug, StructEncoded, StructDecoded, PartialEq)]
struct TextContainer {
    text: String,
    also: String
}

fn main() {
    let mut cursor = Cursor::new(vec![]);
    TextContainer { text: String::from("hi"), also: String::from("bye") }.encode(&mut cursor).unwrap();

    assert_eq!(&vec![
        0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x68, 0x69, // hi
        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x62, 0x79, 0x65 // bye
    ], cursor.get_ref());
    
    cursor.set_position(0);
    assert_eq!(TextContainer { text: String::from("hi"), also: String::from("bye") }, TextContainer::decode(&mut cursor).unwrap());
}