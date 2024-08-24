use binser_macros::make_answer;

make_answer!();

fn main() {
    println!("Hello world {}", answer());
}