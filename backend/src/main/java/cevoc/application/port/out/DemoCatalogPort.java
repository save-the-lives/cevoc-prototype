package cevoc.application.port.out;

import java.util.List;
import java.util.Map;

/**
 * Driven port: the list of demo cases for the demo hub page, grouped by program and then by kind of case. It exists only
 * while demo data is switched on (one place decides that, see {@code DemoDataConfig}). All values are fictitious.
 */
public interface DemoCatalogPort {

    List<Program> programs();

    /** One program block. {@code built} false means the prefix is reserved and has no cases yet. */
    record Program(String prefix, String id, String label, boolean built, String note, List<Group> groups) {}

    /** One kind of case (happy, partial, sad, edge) with its sequence range. */
    record Group(String kind, String range, String title, List<Case> cases) {}

    /**
     * One listed case. {@code transparency} maps an information type (images, certificates, video, details) to
     * the status token the page shows for it; {@code transparencyText} gives each a plain label.
     */
    record Case(String number, String title, String description, String offenceDate, String plate,
                Map<String, String> transparency, Map<String, String> transparencyText) {}
}
