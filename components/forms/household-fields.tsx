"use client";

import { RequiredMark } from "@/components/required-mark";
import { StyledSelect } from "@/components/styled-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FamilyChoice, GuardianChoice } from "@/lib/validations/household";

export interface GuardianOption {
  id: string;
  name: string;
  email: string;
  families: { id: string; name: string }[];
}

export interface FamilyOption {
  id: string;
  name: string;
}

/** What the guardian and family section of the student form holds while editing. */
export interface HouseholdDraft {
  /** "" until the admin has made a choice. */
  guardianMode: "" | "existing" | "new" | "none";
  guardianId: string;
  newGuardian: { name: string; email: string; phone: string; address: string; invite: boolean };
  familyMode: "existing" | "new" | "none";
  familyGroupId: string;
  newFamilyName: string;
}

export type HouseholdErrors = Partial<
  Record<"guardianMode" | "guardianId" | "guardianName" | "guardianEmail" | "familyGroupId" | "familyName", string>
>;

export function emptyHousehold(): HouseholdDraft {
  return {
    guardianMode: "",
    guardianId: "",
    newGuardian: { name: "", email: "", phone: "", address: "", invite: true },
    familyMode: "none",
    familyGroupId: "",
    newFamilyName: "",
  };
}

/** The section's starting point when editing a student who already exists. */
export function householdFor(student: { guardianId: string | null; familyGroupId: string | null }): HouseholdDraft {
  return {
    ...emptyHousehold(),
    guardianMode: student.guardianId ? "existing" : "none",
    guardianId: student.guardianId ?? "",
    familyMode: student.familyGroupId ? "existing" : "none",
    familyGroupId: student.familyGroupId ?? "",
  };
}

export function validateHousehold(draft: HouseholdDraft): HouseholdErrors {
  const errors: HouseholdErrors = {};
  if (draft.guardianMode === "") {
    errors.guardianMode = "Choose a guardian, add a new one, or select “No guardian”";
  } else if (draft.guardianMode === "existing" && !draft.guardianId) {
    errors.guardianId = "Choose a guardian";
  } else if (draft.guardianMode === "new") {
    if (!draft.newGuardian.name.trim()) errors.guardianName = "Guardian name is required";
    const email = draft.newGuardian.email.trim();
    if (!email) errors.guardianEmail = "Guardian email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.guardianEmail = "Enter a valid email address";
  }
  if (draft.familyMode === "existing" && !draft.familyGroupId) errors.familyGroupId = "Choose a family group";
  if (draft.familyMode === "new" && !draft.newFamilyName.trim()) errors.familyName = "Family group name is required";
  return errors;
}

export function householdPayload(draft: HouseholdDraft): { guardian: GuardianChoice; family: FamilyChoice } {
  const guardian: GuardianChoice =
    draft.guardianMode === "existing"
      ? { mode: "existing", guardianId: draft.guardianId }
      : draft.guardianMode === "new"
        ? { mode: "new", ...draft.newGuardian }
        : { mode: "none" };
  const family: FamilyChoice =
    draft.familyMode === "existing"
      ? { mode: "existing", familyGroupId: draft.familyGroupId }
      : draft.familyMode === "new"
        ? { mode: "new", name: draft.newFamilyName }
        : { mode: "none" };
  return { guardian, family };
}

function Choice({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "border-primary bg-accent" : "border-border bg-white hover:bg-muted"
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

/**
 * The "who looks after this student" part of the student form: pick or add a
 * guardian, then pick, add or skip a family group. A guardian does not need a
 * family group, and a new family group includes the guardian automatically.
 */
export function HouseholdFields({
  value,
  onChange,
  errors,
  guardians,
  families,
  studentLastName,
}: {
  value: HouseholdDraft;
  onChange: (value: HouseholdDraft) => void;
  errors: HouseholdErrors;
  guardians: GuardianOption[];
  families: FamilyOption[];
  /** Used to suggest a name for a new family group. */
  studentLastName: string;
}) {
  const set = (patch: Partial<HouseholdDraft>) => onChange({ ...value, ...patch });
  const setNew = (patch: Partial<HouseholdDraft["newGuardian"]>) =>
    onChange({ ...value, newGuardian: { ...value.newGuardian, ...patch } });

  const guardian = guardians.find((g) => g.id === value.guardianId);
  const guardianFamilyIds = new Set(guardian?.families.map((f) => f.id) ?? []);

  function chooseGuardian(guardianId: string) {
    const chosen = guardians.find((g) => g.id === guardianId);
    // A guardian with exactly one family group almost always means that group
    if (chosen?.families.length === 1) {
      set({ guardianId, familyMode: "existing", familyGroupId: chosen.families[0].id });
    } else {
      set({ guardianId });
    }
  }

  function suggestedFamilyName() {
    const last =
      studentLastName.trim() ||
      (value.guardianMode === "new" ? value.newGuardian.name.trim().split(/\s+/).pop() : "") ||
      (guardian?.name.trim().split(/\s+/).pop() ?? "");
    return last ? `${last} Family` : "";
  }

  // The chosen guardian's own family groups first
  const familyOptions = [...families]
    .sort((a, b) => Number(guardianFamilyIds.has(b.id)) - Number(guardianFamilyIds.has(a.id)))
    .map((f) => ({
      value: f.id,
      label: guardianFamilyIds.has(f.id) ? `${f.name} · ${guardian?.name}’s family` : f.name,
    }));

  return (
    <>
      <fieldset className="space-y-3 rounded-xl border border-border/60 p-4">
        <legend id="guardian-legend" className="flex items-center gap-2 px-1 text-sm font-medium">
          Parent or guardian
          <RequiredMark />
        </legend>
        <div role="radiogroup" aria-labelledby="guardian-legend" className="grid gap-2 sm:grid-cols-3">
          <Choice
            checked={value.guardianMode === "existing"}
            onSelect={() => set({ guardianMode: "existing" })}
            title="Existing guardian"
            hint="Already in the system."
          />
          <Choice
            checked={value.guardianMode === "new"}
            onSelect={() => set({ guardianMode: "new" })}
            title="New guardian"
            hint="Add them with contact details."
          />
          <Choice
            checked={value.guardianMode === "none"}
            onSelect={() => set({ guardianMode: "none", guardianId: "" })}
            title="No guardian"
            hint="An adult student."
          />
        </div>
        <FieldError message={errors.guardianMode} />

        {value.guardianMode === "existing" && (
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Guardian
              <span aria-hidden className="ml-0.5 text-destructive">
                *
              </span>
            </label>
            <StyledSelect
              value={value.guardianId}
              onChange={chooseGuardian}
              searchable
              placeholder={guardians.length ? "Choose a guardian..." : "No guardians yet. Add a new one."}
              options={guardians.map((g) => ({ value: g.id, label: `${g.name} — ${g.email}` }))}
            />
            <FieldError message={errors.guardianId} />
          </div>
        )}

        {value.guardianMode === "new" && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="guardian-name">
                  Full name
                  <RequiredMark />
                </Label>
                <Input
                  id="guardian-name"
                  aria-required="true"
                  autoComplete="off"
                  aria-invalid={!!errors.guardianName}
                  aria-describedby={errors.guardianName ? "guardian-name-error" : undefined}
                  value={value.newGuardian.name}
                  onChange={(e) => setNew({ name: e.target.value })}
                />
                <FieldError id="guardian-name-error" message={errors.guardianName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guardian-email">
                  Email
                  <RequiredMark />
                </Label>
                <Input
                  id="guardian-email"
                  type="email"
                  aria-required="true"
                  autoComplete="off"
                  aria-invalid={!!errors.guardianEmail}
                  aria-describedby={errors.guardianEmail ? "guardian-email-error" : undefined}
                  value={value.newGuardian.email}
                  onChange={(e) => setNew({ email: e.target.value })}
                />
                <FieldError id="guardian-email-error" message={errors.guardianEmail} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guardian-phone">Phone</Label>
                <Input
                  id="guardian-phone"
                  type="tel"
                  autoComplete="off"
                  maxLength={20}
                  value={value.newGuardian.phone}
                  onChange={(e) => setNew({ phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guardian-address">Address</Label>
                <Input
                  id="guardian-address"
                  autoComplete="off"
                  maxLength={300}
                  value={value.newGuardian.address}
                  onChange={(e) => setNew({ address: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                checked={value.newGuardian.invite}
                onChange={(e) => setNew({ invite: e.target.checked })}
              />
              Send them a link to set up their parent portal account
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border/60 p-4">
        <legend id="family-legend" className="px-1 text-sm font-medium">
          Family group
        </legend>
        <p className="text-xs text-muted-foreground">
          A family group puts everyone on one invoice and applies sibling discounts. It is optional:
          a student can have a guardian without one.
        </p>
        <div role="radiogroup" aria-labelledby="family-legend" className="grid gap-2 sm:grid-cols-3">
          <Choice
            checked={value.familyMode === "none"}
            onSelect={() => set({ familyMode: "none", familyGroupId: "" })}
            title="No family group"
            hint="Billed on their own."
          />
          <Choice
            checked={value.familyMode === "existing"}
            onSelect={() => set({ familyMode: "existing" })}
            title="Existing family"
            hint="Join a family group."
          />
          <Choice
            checked={value.familyMode === "new"}
            onSelect={() =>
              set({ familyMode: "new", newFamilyName: value.newFamilyName || suggestedFamilyName() })
            }
            title="New family group"
            hint={value.guardianMode === "none" ? "Create one now." : "Includes the guardian."}
          />
        </div>

        {value.familyMode === "existing" && (
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Family group
              <span aria-hidden className="ml-0.5 text-destructive">
                *
              </span>
            </label>
            <StyledSelect
              value={value.familyGroupId}
              onChange={(familyGroupId) => set({ familyGroupId })}
              searchable={families.length > 6}
              placeholder={families.length ? "Choose a family group..." : "No family groups yet. Create a new one."}
              options={familyOptions}
            />
            <FieldError message={errors.familyGroupId} />
          </div>
        )}

        {value.familyMode === "new" && (
          <div className="grid gap-2">
            <Label htmlFor="family-name">
              Family group name
              <RequiredMark />
            </Label>
            <Input
              id="family-name"
              aria-required="true"
              autoComplete="off"
              aria-invalid={!!errors.familyName}
              aria-describedby={errors.familyName ? "family-name-error" : undefined}
              value={value.newFamilyName}
              onChange={(e) => set({ newFamilyName: e.target.value })}
            />
            <FieldError id="family-name-error" message={errors.familyName} />
          </div>
        )}
      </fieldset>
    </>
  );
}
