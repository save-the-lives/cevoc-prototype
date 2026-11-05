package cevoc;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** Keeps the hexagon honest: dependencies point inwards only. */
@AnalyzeClasses(packages = "cevoc", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule domainIsPure = noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage("..application..", "..adapter..", "org.springframework..");

    @ArchTest
    static final ArchRule applicationIgnoresAdapters = noClasses().that().resideInAPackage("..application..")
            .should().dependOnClassesThat().resideInAnyPackage("..adapter..", "org.springframework..");

    @ArchTest
    static final ArchRule adaptersDoNotTalkToEachOther = noClasses().that().resideInAPackage("..adapter.in..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out..");

    @ArchTest
    static final ArchRule coreHasNoCloudSdk = noClasses().that().resideInAnyPackage("..domain..", "..application..")
            .should().dependOnClassesThat().resideInAnyPackage("com.azure..", "software.amazon..", "com.amazonaws..",
                    "com.google.cloud..", "com.aliyun..", "com.oracle.bmc..");

    @ArchTest
    static final ArchRule azureAdapterIsIsolated = noClasses().that().resideInAPackage("..adapter.out.azureblob..")
            .should().dependOnClassesThat().resideInAnyPackage("..adapter.out.s3..", "software.amazon..", "com.amazonaws..");

    @ArchTest
    static final ArchRule s3AdapterIsIsolated = noClasses().that().resideInAPackage("..adapter.out.s3..")
            .should().dependOnClassesThat().resideInAnyPackage("..adapter.out.azureblob..", "com.azure..");

    @ArchTest
    static final ArchRule onlyAzureAdapterUsesAzureSdk = noClasses()
            .that().resideOutsideOfPackages("..adapter.out.azureblob..", "..config..")
            .should().dependOnClassesThat().resideInAPackage("com.azure..");

    /** Demo data is its own adapter: only the demo adapter itself, the one config that switches it, and the wiring may know it. */
    @ArchTest
    static final ArchRule nothingKnowsTheDemoAdapterExceptItsWiring = noClasses()
            .that().resideOutsideOfPackages("..adapter.out.demo..", "..config..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out.demo..");

    @ArchTest
    static final ArchRule demoAdapterOnlyUsesPortsAndDomain = noClasses().that().resideInAPackage("..adapter.out.demo..")
            .should().dependOnClassesThat().resideInAnyPackage("..adapter.in..", "..adapter.out.scraper..", "..adapter.out.revenuensw..",
                    "..adapter.out.azureblob..", "..adapter.out.memory..", "..adapter.out.stub..", "org.springframework..", "com.microsoft..");

    /** Banner OCR is its own adapter: only it and the wiring may know it, and it uses only ports and domain. */
    @ArchTest
    static final ArchRule nothingKnowsTheOcrAdapterExceptItsWiring = noClasses()
            .that().resideOutsideOfPackages("..adapter.out.ocr..", "..config..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out.ocr..");

    @ArchTest
    static final ArchRule ocrAdapterOnlyUsesPortsAndDomain = noClasses().that().resideInAPackage("..adapter.out.ocr..")
            .should().dependOnClassesThat().resideInAnyPackage("..adapter.in..", "..adapter.out.scraper..", "..adapter.out.revenuensw..",
                    "..adapter.out.azureblob..", "..adapter.out.memory..", "..adapter.out.stub..", "..adapter.out.demo..", "org.springframework..");

    /** No OCR library may leak elsewhere (the engine is called as a program today; these are the usual Java wrappers). */
    @ArchTest
    static final ArchRule onlyOcrAdapterUsesOcrLibraries = noClasses().that().resideOutsideOfPackage("..adapter.out.ocr..")
            .should().dependOnClassesThat().resideInAnyPackage("net.sourceforge.tess4j..", "org.bytedeco.tesseract..", "org.bytedeco.leptonica..");

    /** The domain and application layers never start programs. */
    @ArchTest
    static final ArchRule coreStartsNoProcesses = noClasses().that().resideInAnyPackage("..domain..", "..application..")
            .should().dependOnClassesThat().haveFullyQualifiedName("java.lang.ProcessBuilder");
}
