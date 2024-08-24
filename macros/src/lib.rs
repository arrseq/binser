use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Data, Fields};

#[proc_macro_derive(StructEncoded)]
pub fn struct_encoded(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let Data::Struct(data) = &input.data else { panic!("StructEncoded can only be used on structs")};
    
    let fields = match &data.fields {
        Fields::Named(fields) => &fields.named,
        _ => panic!("StructEncoded can only be used with named fields"),
    };

    let mut encode_fields = Vec::new();
    let mut field_names = Vec::new();

    for field in fields {
        let field_name = &field.ident;

        encode_fields.push(quote! {
            self.#field_name.encode(output)?;
        });

        field_names.push(field_name);
    }

    let expanded = quote! {
        impl ::binser::encoding::Encoded for #name {
            fn encode(&self, output: &mut impl ::std::io::Write) -> ::std::io::Result<()> {
                #(#encode_fields)*
                Ok(())
            }
        }
    };

    TokenStream::from(expanded)
}

#[proc_macro_derive(StructDecoded)]
pub fn struct_decoded(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let Data::Struct(data) = &input.data else { panic!("StructDecoded can only be used on structs")};

    let fields = match &data.fields {
        Fields::Named(fields) => &fields.named,
        _ => panic!("StructDecoded can only be used with named fields"),
    };

    let mut decode_fields = Vec::new();
    let mut field_names = Vec::new();

    for field in fields {
        let field_name = &field.ident;
        let encoded_type = quote! { ::binser::encoding::Encoded };
        
        decode_fields.push(quote! {
            let #field_name = #encoded_type::decode(input)?;
        });

        field_names.push(field_name);
    }

    let expanded = quote! {
        impl ::binser::encoding::Encoded for #name {
            fn decode(input: &mut impl ::std::io::Read) -> ::std::io::Result<Self> {
                #(#decode_fields)*
                Ok(#name {
                    #(#field_names: #field_names,)*
                })
            }
        }
    };

    TokenStream::from(expanded)
}

#[proc_macro_derive(EnumEncoded)]
pub fn enum_encoded(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let Data::Enum(data) = &input.data else {
        panic!("EnumEncoded can only be used on enums");
    };

    let variants = &data.variants;
    let num_variants = variants.len();

    // Determine the smallest integer type for variant codes
    let variant_code_type = match num_variants {
        0..=255 => quote! { u8 },
        256..=65535 => quote! { u16 },
        65536..=4294967295 => quote! { u32 },
        _ => quote! { u64 },
    };

    let mut encode_variants = Vec::new();

    for (index, variant) in variants.iter().enumerate() {
        let variant_name = &variant.ident;
        let variant_code = index as u64; // Code for the variant
        let variant_code_literal = match variant_code_type.to_string().as_str() {
            "u8" => quote! { #variant_code as u8 },
            "u16" => quote! { #variant_code as u16 },
            "u32" => quote! { #variant_code as u32 },
            "u64" => quote! { #variant_code },
            _ => quote! { #variant_code },
        };

        if let Fields::Named(fields) = &variant.fields {
            let mut encode_calls = Vec::new();
            let field_names: Vec<_> = fields.named.iter().map(|f| &f.ident).collect();

            for field in &fields.named {
                let field_name = &field.ident;
                encode_calls.push(quote! { 
                    ::binser::encoding::Encoded::encode(#field_name, output);
                });
            }

            encode_variants.push(quote! {
                #name::#variant_name { #(#field_names),* } => {
                    let variant_code: #variant_code_type = #variant_code_literal;
                    output.write_all(&variant_code.to_le_bytes())?;
                    #(#encode_calls)*
                }
            });
        } else {
            encode_variants.push(quote! {
                #name::#variant_name => {
                    let variant_code: #variant_code_type = #variant_code_literal;
                    output.write_all(&variant_code.to_le_bytes())?;
                }
            });
        }
    }

    let expanded = quote! {
        impl ::binser::encoding::Encoded for #name {
            fn encode(&self, output: &mut impl ::std::io::Write) -> ::std::io::Result<()> {
                match self {
                    #(#encode_variants)*
                }
                Ok(())
            }
        }
    };

    TokenStream::from(expanded)
}

#[proc_macro_derive(EnumDecoded)]
pub fn enum_decoded(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let Data::Enum(data) = &input.data else {
        panic!("EnumDecoded can only be used on enums");
    };

    let variants = &data.variants;
    let num_variants = variants.len();

    // Determine the smallest integer type for variant codes
    let variant_code_type = match num_variants {
        0..=255 => quote! { u8 },
        256..=65535 => quote! { u16 },
        65536..=4294967295 => quote! { u32 },
        _ => quote! { u64 },
    };

    let mut decode_variants = Vec::new();

    for (index, variant) in variants.iter().enumerate() {
        let variant_name = &variant.ident;
        let variant_code = index as u64; // Code for the variant
        let variant_code_literal = match variant_code_type.to_string().as_str() {
            "u8" => quote! { #variant_code as u8 },
            "u16" => quote! { #variant_code as u16 },
            "u32" => quote! { #variant_code as u32 },
            "u64" => quote! { #variant_code },
            _ => quote! { #variant_code },
        };

        if let Fields::Named(fields) = &variant.fields {
            let mut decode_fields = Vec::new();
            let field_types: Vec<_> = fields.named.iter().map(|f| &f.ty).collect();

            for field_type in field_types {
                decode_fields.push(quote! {
                    let field_value = <#field_type as ::binser::encoding::Decoded>::decode(input)?;
                });
            }

            decode_variants.push(quote! {
                #variant_code_literal => Ok(#name::#variant_name {
                    #(
                        #decode_fields
                    )*
                })
            });
        } else {
            decode_variants.push(quote! {
                #variant_code_literal => Ok(#name::#variant_name),
            });
        }
    }

    let expanded = quote! {
        impl ::binser::encoding::Decoded for #name {
            fn decode(input: &mut impl ::std::io::Read) -> ::std::io::Result<Self> {
                let mut variant_code_buf = [0; std::mem::size_of::<#variant_code_type>()];
                input.read_exact(&mut variant_code_buf)?;
                let variant_code = #variant_code_type::from_le_bytes(variant_code_buf);
                
                match variant_code {
                    #(#decode_variants)*
                    _ => Err(::std::io::Error::new(::std::io::ErrorKind::InvalidData, "Unknown variant code")),
                }
            }
        }
    };

    TokenStream::from(expanded)
}