// the elements of the iFactr interfaces and the render:slint engine
fn main() {
    slint_build::compile("ui/ifactr.slint").unwrap();
    println!("cargo:rerun-if-changed=ui/ifactr.slint");
}
