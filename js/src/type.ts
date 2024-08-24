export enum Size {X8, X16, X32, X64}

export enum TypeName {
    Bool,

    U,
    I,
    F16,
    F32,
    F64,

    String,
    Enum,

    Array,
    Vector
}

export interface BoolType { type: TypeName.Bool }
export interface UintType { type: TypeName.U, size: Size }
export interface IntType { type: TypeName.I, size: Size }
export interface FType {
    type: TypeName.F16
        | TypeName.F32
        | TypeName.F64
}
export interface StringType { type: TypeName.String }
export interface Enum {
    type: TypeName.Enum,
    key_size: Size,
    items: Types[]
}
export interface ArrayType {
    type: TypeName.Array,
    item_type: Type,
    length: bigint
}
export interface VectorType {
    type: TypeName.Vector,
    item_type: Type
}

export type Type = BoolType
    | UintType
    | IntType
    | FType
    | StringType
    | Enum
    | ArrayType
    | VectorType;
export type Types = Type[];

export function new_type(type: Type): Type { return type; }

export interface ParseResult<T> {
    value: T,
    length: number
}

export function new_result<T>(res: ParseResult<T>): ParseResult<T> { return res; }

export function parse_size(tstr: string): ParseResult<Size> | null {
    if (tstr.startsWith("8")) { return { value: Size.X8, length: 1 }; }
    if (tstr.startsWith("16")) { return { value: Size.X16, length: 2 }; }
    if (tstr.startsWith("32")) { return { value: Size.X32, length: 2 }; }
    if (tstr.startsWith("64")) { return { value: Size.X64, length: 2 }; }
    return null;
}

export function parse_object(o: string): ParseResult<Types> | null {
    let l = 1;
    o = o.substring(1);

    let type_out: Types = [];

    while (true) {
        let ty = parse_type(o);
        if (ty == null) { console.log("Invalid type", o); return null; }
        l += ty.length;

        type_out.push(ty.value);
        o = o.substring(ty.length);

        if (o.startsWith("]")) {
            l += 1;
            break;
        }

        if (o.startsWith(", ")) {
            o = o.substring(2);
            l += 2;
        }
    }

    return new_result({
        value: type_out,
        length: l
    });
}

export function parse_num(tstr: string): ParseResult<bigint> | null {
    let index = 0;
    while (index < tstr.length && /\d/.test(tstr[index])) {
        index++;
    }

    if (index === 0) {
        return null;
    }

    const num = BigInt(tstr.slice(0, index));
    return { value: num, length: index };
}

export function parse_type(tstr: string): ParseResult<Type> | null {
    let len = 0;
    if (tstr.startsWith("bool")) { return new_result({
        value: new_type({ type: TypeName.Bool }),
        length: 4
    }); }
    if (tstr.startsWith("u") || tstr.startsWith("i")) {
        let ui = tstr.startsWith("u") ? TypeName.U : TypeName.I;
        tstr = tstr.substring(1);
        len += 1;

        let size = parse_size(tstr);
        if (size == null) { return null; }
        len += size.length;

        return new_result({
            value: new_type({type: ui, size: size.value}),
            length: len
        });
    }
    if (tstr.startsWith("f")) {
        tstr = tstr.substring(1);
        len += 1;

        let size = parse_size(tstr);
        if (size == null || size.value == Size.X8) { return null; }
        len += size.length;

        let type: TypeName;
        switch (size.value) {
            case Size.X16:
                type = TypeName.F16;
                break;
            case Size.X32:
                type = TypeName.F32;
                break;
            case Size.X64:
                type = TypeName.F64;
                break;
        }

        return new_result({
            value: new_type({ type }),
            length: len
        });
    }

    // enum[si] ty
    // [ty; le]
    // [ty]

    let enum_word = "enum[";
    let cs = ", ";
    let ss = "; ";

    if (tstr.startsWith(enum_word)) {
        tstr = tstr.substring(enum_word.length);
        len += enum_word.length;

        let size = parse_size(tstr);
        if (size == null) { return null; }
        tstr = tstr.substring(size.length + 2); // remove closing bracket and space
        len += size.length += 2;

        let tys = [];

        while (true) {
            let obj = parse_object(tstr);
            if (obj == null) { return null; }
            tstr = tstr.substring(obj.length);
            len += obj.length;

            tys.push(obj.value);


            // check for ", " to indicate next
            if (tstr.startsWith(cs)) {
                tstr = tstr.substring(cs.length);
                len += cs.length;
            } else { break; }
        }

        return new_result({
            value: new_type({ type: TypeName.Enum, key_size: size.value, items: tys }),
            length: len
        });
    } else if (tstr.startsWith("[") && tstr.endsWith("]")) {
        tstr = tstr.substring(1);
        len += 1;

        let ty = parse_type(tstr);
        if (ty == null) { console.log("Failed to parse type"); return null; }
        tstr = tstr.substring(ty.length);
        len += ty.length;

        if (tstr.startsWith(ss)) {
            tstr = tstr.substring(ss.length);
            len += ss.length;

            let array_len = parse_num(tstr);
            if (array_len == null) { console.log("Cannot parse array length, but found length sequence"); return null; }
            len += array_len.length;
            tstr = tstr.substring(array_len.length);

            if (tstr.startsWith("]")) { len += 1; }
            else { console.log("Missing closing bracket for array/vector"); return null; }

            return new_result({
                value: new_type({
                    type: TypeName.Array,
                    item_type: ty.value,
                    length: array_len.value
                }),
                length: len
            });
        }

        if (tstr.startsWith("]")) { len += 1; }
        else { console.log("Missing closing bracket for array/vector"); return null; }

        return new_result({
            value: new_type({
                type: TypeName.Vector,
                item_type: ty.value
            }),
            length: len
        })
    }

    return null;
}
