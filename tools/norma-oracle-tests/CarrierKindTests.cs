namespace Arest.NormaOracle.Tests
{
    public class CarrierKindTests
    {
        const string Base =
            "DEF(\"state:pop\", S(S9(S2(A(\"a\"), N(1)), S2(A(\"b\"), N(2)), S2(A(\"c\"), N(3)), S2(A(\"d\"), N(4)), S2(A(\"e\"), N(5)), S2(A(\"f\"), N(6)), S2(A(\"g\"), N(7)), S2(A(\"h\"), N(8)), S2(A(\"i\"), N(9))), S1(S2(A(\"j\"), N(10))))),\n"
            + "DEF(\"state:row\", S3(A(\"x\"), N(1), N(2))),\n";

        [Fact]
        public void TheSameTextIsIdentical()
        {
            Assert.Equal("identical", CarrierKind.Classify(Base, Base));
        }

        [Fact]
        public void AChunkedCollectionInAnotherOrderIsOrderOnly()
        {
            string reordered = Base.Replace("S2(A(\"a\"), N(1)), S2(A(\"b\"), N(2))", "S2(A(\"b\"), N(2)), S2(A(\"a\"), N(1))");
            Assert.NotEqual(Base, reordered);
            Assert.Equal("order only", CarrierKind.Classify(Base, reordered));
        }

        [Fact]
        public void ADirectCollectionInAnotherOrderIsContent()
        {
            // a row carries position: N(1), N(2) is not N(2), N(1)
            string swapped = Base.Replace("S3(A(\"x\"), N(1), N(2))", "S3(A(\"x\"), N(2), N(1))");
            Assert.Equal("content", CarrierKind.Classify(Base, swapped));
            Assert.Equal(new[] { "state:row" }, CarrierKind.DifferingCells(Base, swapped));
        }

        [Fact]
        public void AChangedAtomIsContent()
        {
            string changed = Base.Replace("S2(A(\"j\"), N(10))", "S2(A(\"j\"), N(11))");
            Assert.Equal("content", CarrierKind.Classify(Base, changed));
            Assert.Equal(new[] { "state:pop" }, CarrierKind.DifferingCells(Base, changed));
        }

        [Fact]
        public void ACellOnOneSideOnlyIsContent()
        {
            string fewer = Base.Replace("DEF(\"state:row\", S3(A(\"x\"), N(1), N(2))),\n", "");
            Assert.Equal("content", CarrierKind.Classify(Base, fewer));
        }

        [Fact]
        public void AnEmptyChunkedCollectionIsTheEmptySet()
        {
            string empty = "DEF(\"state:pop\", S1(PHI())),\n";
            Assert.Equal("identical", CarrierKind.Classify(empty, empty));
            Assert.Equal("content", CarrierKind.Classify(empty, "DEF(\"state:pop\", S1(S1(A(\"a\")))),\n"));
        }
    }
}
