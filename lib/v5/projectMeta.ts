export function buildEquipmentType(description: string, notes?: string) {
  const trimmedDescription = description.trim();
  const trimmedNotes = notes?.trim();
  if (!trimmedNotes) return trimmedDescription;
  return `${trimmedDescription} || ${trimmedNotes}`;
}

export function parseEquipmentType(value: string | null | undefined) {
  const source = value ?? "";
  const [description, notes] = source.split("||").map((part) => part.trim());
  return {
    projectDescription: description || "No description",
    projectNotes: notes || ""
  };
}
