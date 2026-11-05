package cevoc.adapter.out.demo;

/** What the page shows for one information type of a demo case (the transparency status; see decision record 0007). */
public enum DemoStatus {
    AVAILABLE("Shown"),
    PARTIAL("Shown in part"),
    NOT_RETURNED("Not returned, said plainly"),
    HELD_BACK("Held back until the number plate is given"),
    FAILED("Technical failure, said plainly"),
    NO_RULES("No display rules, default message"),
    NOT_APPLICABLE("No notice, nothing to show");

    private final String text;

    DemoStatus(String text) {
        this.text = text;
    }

    public String text() {
        return text;
    }
}
