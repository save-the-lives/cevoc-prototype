package au.gov.nsw.transport.cevoc;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** Keeps the hexagon honest: dependencies point inwards only. */
@AnalyzeClasses(packages = "au.gov.nsw.transport.cevoc", importOptions = ImportOption.DoNotIncludeTests.class)
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
}
