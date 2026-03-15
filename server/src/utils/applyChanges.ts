export function applyChanges(oldCode: string, changes: any[]): string {
  if (!Array.isArray(changes)) {
    console.error("Invalid changes: expected array", changes);
    return oldCode;
  }

  try {
    let newCode = oldCode;
    const sortedChanges = [...changes].sort(
      (a, b) => b.rangeOffset - a.rangeOffset,
    );

    for (const change of sortedChanges) {
      if (
        typeof change.rangeOffset !== "number" ||
        typeof change.rangeLength !== "number" ||
        typeof change.text !== "string"
      ) {
        console.error("Invalid change object:", change);
        continue;
      }

      const { rangeOffset, rangeLength, text } = change;
      if (rangeOffset < 0 || rangeOffset > newCode.length) {
        console.error(
          `Invalid rangeOffset: ${rangeOffset}, code length: ${newCode.length}`,
        );
        continue;
      }

      newCode =
        newCode.substring(0, rangeOffset) +
        text +
        newCode.substring(rangeOffset + rangeLength);
    }
    return newCode;
  } catch (error) {
    console.error("Error applying changes:", error);
    return oldCode;
  }
}
