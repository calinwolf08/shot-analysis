import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import Page from "./+page.svelte";

describe("/+page.svelte", () => {
  it("renders the ShotCoach heading", () => {
    render(Page);
    expect(screen.getByRole("heading", { name: "ShotCoach" })).toBeTruthy();
  });
});
