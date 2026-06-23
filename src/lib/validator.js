function validateStructuredProcess(processModel) {
  const errors = [];
  const warnings = [];

  if (!processModel.trigger) {
    errors.push({
      code: "missing_start",
      message: "Der Prozess braucht einen klaren Start oder Auslöser."
    });
  }

  if (!Array.isArray(processModel.steps) || processModel.steps.length < 2) {
    errors.push({
      code: "missing_flow",
      message: "Der Ablauf braucht mindestens zwei nachvollziehbare Schritte."
    });
  }

  if (!Array.isArray(processModel.roles) || processModel.roles.length === 0) {
    errors.push({
      code: "missing_responsibilities",
      message: "Mindestens eine verantwortliche Rolle muss benannt sein."
    });
  }

  if (!Array.isArray(processModel.endStates) || processModel.endStates.length === 0) {
    errors.push({
      code: "missing_end",
      message: "Der Prozess braucht ein klares Ende oder Ergebnis."
    });
  }

  const unclearOwners = (processModel.steps || []).filter((step) => !step.owner || step.owner === "Unklar");
  if (unclearOwners.length > 0) {
    errors.push({
      code: "unclear_step_owner",
      message: "Ein oder mehrere Schritte haben noch keine klare Verantwortlichkeit."
    });
  }

  if ((processModel.steps || []).length > 12) {
    warnings.push({
      code: "many_steps",
      message: "Der Prozess hat viele Schritte. Für eine Unterrichtsansicht kann eine Zusammenfassung sinnvoll sein."
    });
  }

  if (processModel.profile === "swimlane" && (processModel.decisions || []).length > 0) {
    warnings.push({
      code: "swimlane_decisions",
      message: "Im Swimlane-Profil werden Entscheidungen vereinfacht als Prüfschritte dargestellt."
    });
  }

  if ((processModel.exceptions || []).length === 0) {
    warnings.push({
      code: "no_exceptions",
      message: "Es wurden keine Sonderfälle erkannt. Das ist zulässig, sollte aber fachlich geprüft werden."
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { validateStructuredProcess };
