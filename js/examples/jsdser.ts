// import {Decoder} from "../src/lib";

// let dec = new Decoder({
//     aaa: "u8",
//     hello: "@!21u821;@!@!4]",
//     var: "[u64]"
// });
//
// // aaa = 10
// // hello = 3 4 16 0
// // var = 2 elems, 1 and 0
// dec.decode_arr([ 0b00001010, 0b00000011, 0b00000100, 0b00001111, 0b00000000, 0b00000010, 0b00000001, 0b00000000 ]);

import {parse_num, parse_object, parse_type} from "../src/type";

// let enm = parse_type("[u8; 10]")!.value as any;
// console.log(enm.items);

console.log(parse_type("[u8]"));