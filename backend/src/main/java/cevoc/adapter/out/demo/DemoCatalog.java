package cevoc.adapter.out.demo;

import cevoc.application.port.out.DemoCatalogPort;
import cevoc.application.port.out.DemoMediaPort;
import cevoc.domain.MediaContent;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The demo hub's list of cases and the generated media, both read from the factory's scenario list (one source of truth). */
public final class DemoCatalog implements DemoCatalogPort, DemoMediaPort {

    private final DemoCaseFactory factory;

    public DemoCatalog(DemoCaseFactory factory) {
        this.factory = factory;
    }

    @Override
    public List<Program> programs() {
        List<Program> out = new ArrayList<>();
        for (DemoProgram p : DemoProgram.values()) {
            List<Group> groups = new ArrayList<>();
            if (p.built()) {
                for (DemoNumber.Kind kind : DemoNumber.Kind.values()) {
                    List<Case> cases = factory.scenarios().stream()
                            .filter(s -> s.program() == p && s.kind() == kind).map(DemoCatalog::toCase).toList();
                    groups.add(new Group(kind.name().toLowerCase(java.util.Locale.ROOT), kind.range(), kind.title(), cases));
                }
            }
            out.add(new Program(p.prefix(), p.name(), p.label(), p.built(), p.note(), groups));
        }
        return out;
    }

    static Case toCase(DemoScenario s) {
        Map<String, String> status = new LinkedHashMap<>();
        Map<String, String> text = new LinkedHashMap<>();
        s.expected().forEach((info, st) -> {
            status.put(info.token(), st.name().toLowerCase(java.util.Locale.ROOT));
            text.put(info.token(), st.text());
        });
        return new Case(s.number(), s.title(), s.description(), s.offenceDate().toString(),
                s.plate() == DemoScenario.Plate.GATED ? DemoCaseFactory.PLATE : null, status, text);
    }

    @Override
    public Optional<MediaContent> read(String number, String name) {
        return factory.mediaSource().read(number, name).map(b -> new MediaContent(b.contentType(), b.data()));
    }
}
