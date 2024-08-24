# Binary Serializer
A tool used to encode and decode complex binary structures.

# Warning
This library has many flaws that will not be fixed. They do not cause problems if the tool is used correctly.
- The parser is very basic, for example in many places you have to use a space after a comma `, `, `; `, and `: `.
- The library does not have any good error handling. 

# TypeScript usage
```ts
let dec = new Decoder({
    hello: "u8",
    world: "[u8; 2]"
});

let buf = new Uint8Array(3);
buf[0] = 10;  // hello = 10
buf[1] = 105; // world[0] = 105
buf[2] = 204; // world[1] = 204
console.log(dec.decode(0n, buf)[0]);

// Rust equivilant
// struct Dec {
//     hello: u8,
//     world: [u8; 2]
// }
```

# Features
This encoding supports the following data types:
- booleans.
- unsigned and signed ints of 8, 16, 32 and 64 bits.
- floating point types for 16, 32 and 64 bits.
- utf8 encoded strings.
- fixed and variable length arrays.
- enums with differing variant fields.
