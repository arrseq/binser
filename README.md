# Binary Serializer
A __scuffed__ tool used to encode and decode complex binary structures. This encoding can be very fast for large data if used correctly.

This library can be useful in a variety of situations:
- When sending complex structured data between a server and client.
- When sending complex structured data between 2 different processes in a different programming language.
- To store complex structures in a file

And more!

# Warning
This library has many flaws that will not be fixed. They do not cause problems if the tool is used correctly.
- The parser is very basic, for example in many places you have to use a space after a comma `, `, `; `, and `: `.
- The library does not have any good error handling. 
- Extremely large numbers, arrays, enums and more can become misrepresented due to rounding from the javascript runtime. 
- __Poor performance__ with complicated arrays or large arrays. Pros & Cons of `x:` vs generic. 
  - Generic Pro: Arrays can be nested
  - Generic Con: May become a bottleneck if the data is large, an enum switch between `x:`/generic is recommended for larger arrays.
  - `x:` Pro: Extremely fast for large arrays.
  - `x:` Con: Cannot contain an enum or array/vector as its type.

# `x:` Buffered Indicator
should be used for screen buffers. Whether enabled or not, this has no effect on the encoding/decoding result and only affects performance.
 - Generic `[u8]` `[u8; 4]`
 - Buffered `[x:u8]` `[u8; x:4]`

Invalid buffered cases
 - `[x:[u8]]`
 - `[[u8]; x:4]`

# TypeScript usage
```ts
interface Struct {
    hello: number,
    world: [number, number]
}

let dec = new Decoder<Struct>({
    hello: "u8",
    world: "[u8; 2]"
});

let buf = new Uint8Array(3);
buf[0] = 10;  // hello = 10
buf[1] = 105; // world[0] = 105
buf[2] = 204; // world[1] = 204
console.log(dec.decode(0n, buf)[0]);

// Rust equivalent
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
