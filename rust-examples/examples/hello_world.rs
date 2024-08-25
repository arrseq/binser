extern crate xbinser;
extern crate xbinser_macros;

use std::io::{Cursor, Seek};
use xbinser::encoding::{Decoded, Encoded};
use xbinser_macros::{EnumDecoded, EnumEncoded, StructDecoded, StructEncoded};


#[derive(Debug, StructEncoded, StructDecoded, PartialEq)]
struct TextContainer {
    text: String
}

fn main() {
    let mut cursor = Cursor::new(vec![]);
    TextContainer { text: String::from("Hello World") }.encode(&mut cursor).unwrap();

    assert_eq!(&vec![0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x57, 0x6F, 0x72, 0x6C, 0x64], cursor.get_ref());
    
    cursor.set_position(0);
    assert_eq!(TextContainer { text: String::from("Hello World") }, TextContainer::decode(&mut cursor).unwrap());
}