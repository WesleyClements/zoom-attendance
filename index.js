(() => {
  const EXPECTED_HEADERS = ['userName', 'userEmail', 'joinTime', 'leaveTime', 'duration', 'attentivenessScore'];
  const DISPLAYED_HEADERS = ["#", "Name", "Joined At", "Left At", "Duration (Minutes)"];
  const DISPLAYED_COLUMNS = ['userName', 'joinTime', 'leaveTime', 'duration'];

  const KEY_SEPARATORS = [" ", ".", "-"];

  const IGNORED_NAMES_KEY = "ignoredNames";

  const ignoredNames = JSON.parse(localStorage.getItem(IGNORED_NAMES_KEY) || "null") ?? [];

  if (!Array.isArray(ignoredNames)) {
    throw new Error("ignoredNames not an array");
  }

  const inputFormEl = document.querySelector("form");

  if (!inputFormEl) {
    throw new Error("no input form");
  }

  /** @type {HTMLInputElement | null} */
  const fileInputEl = inputFormEl.querySelector("input[name=\"csvFile\"]");
  /** @type {HTMLDivElement | null} */
  const ignoredNamesEl = inputFormEl.querySelector("#ignored-names div");
  /** @type {HTMLButtonElement | null} */
  const addIgnoredNameButtonEl = inputFormEl.querySelector("#ignored-names button");
  const errorEl = inputFormEl.querySelector("input[name=\"csvFile\"] + .invalid-feedback");

  if (!fileInputEl) {
    throw new Error("no file input");
  }
  if (!ignoredNamesEl) {
    throw new Error("no ignored names div");
  }
  if (!addIgnoredNameButtonEl) {
    throw new Error("no add ignored names button");
  }
  if (!errorEl) {
    throw new Error("no file input error");
  }

  const addIgnoredName = (value) => {
    const index = ignoredNames.length;
    ignoredNames.push(value);
    localStorage.setItem(IGNORED_NAMES_KEY, JSON.stringify(ignoredNames));
    return index;
  };

  const removeIgnoredName = (index) => {
    ignoredNames.splice(index, 1);
    localStorage.setItem(IGNORED_NAMES_KEY, JSON.stringify(ignoredNames));
  };

  const setIgnoredName = (index, value) => {
    ignoredNames[index] = value;
    localStorage.setItem(IGNORED_NAMES_KEY, JSON.stringify(ignoredNames));
  };

  const debounce = (func, timeout) => {
    let handle;
    return (...args) => {
      clearTimeout(handle);
      setTimeout(() => {
        func(...args);
      }, timeout);
    };
  };

  /**
   * @param {number} index 
   * @param {string} value 
   */
  const createIgnoredNameInput = (index, value) => {
    const wrapperEl = document.createElement("div");
    wrapperEl.classList.add("input-group", "mb-1");
    const inputEl = document.createElement("input");
    inputEl.classList.add("form-control");
    inputEl.value = value || "";
    inputEl.addEventListener(
      "input", debounce(
        () => {
          setIgnoredName(index, inputEl.value);
        },
        100
      )
    );
    const buttonWrapper = document.createElement("div");
    buttonWrapper.classList.add("input-group-append");
    const removeButton = document.createElement("button");
    removeButton.classList.add("btn", "btn-outline-danger");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      ignoredNamesEl.removeChild(wrapperEl);
      removeIgnoredName(index);
    });
    removeButton.textContent = "X";
    buttonWrapper.appendChild(removeButton);
    wrapperEl.append(inputEl, buttonWrapper);
    return wrapperEl;
  };

  const capitalize = (word) => word.charAt(0).toUpperCase() + word.substring(1);

  const parseCSV = async (file) => {
    if (!(file instanceof File)) {
      throw new Error("invalid form data");
    }
    if (!file.name.endsWith(".csv")) {
      throw new Error("File must be .csv");
    }

    const text = await file.text();
    const lines = text.split(/\r\n|\n/m);
    return {
      headers: (lines.shift() || "")
        .split(",")
        .map((header) => header
          .split(" ")
          .map((word) => word.split("(")[0])
          .map((word, i) => i ? capitalize(word) : word.toLowerCase())
          .join("")
        ),
      lines
    };
  };

  /**
   * @param {string} key 
   * @returns 
   */
  const splitKey = (key) => KEY_SEPARATORS
    .map((separator) => key.split(separator))
    .find((array) => array.length === 2)
    || [key];

  /**
   * @param {Set<string>} set 
   * @param {string} value
   */
  const getPermutation = (set, value) => {
    if (set.has(value)) {
      return value;
    }
    const parts = splitKey(value);
    return Array
      .from(
        { length: parts.length },
        (_, i) => [...parts.slice(i), ...parts.slice(0, i)]
      )
      .flatMap((permutation) => KEY_SEPARATORS
        .map((separator) => permutation.join(separator))
      )
      .find((key) => set.has(key));
  };

  const collectByKey = (array, keyMapper) => {
    const keySet = new Set();
    const map = new Map();
    array.forEach((item, i) => {
      const key = keyMapper(item, i);
      if (!key) return;
      const uniqueKey = getPermutation(keySet, key) || key;
      if (map.has(uniqueKey)) {
        map.get(uniqueKey).push(item);
      } else {
        map.set(uniqueKey, [item]);
        keySet.add(uniqueKey);
      }
    });
    return map;
  };

  const getOutputEl = () => {
    const existingEl = document.querySelector("#output");
    if (existingEl) return existingEl;
    const newEl = document.createElement("div");
    newEl.id = "output";
    document.querySelector("main")?.append(newEl);
    return newEl;
  };

  const createSummaryTable = (summaries) => {
    const tableEl = document.createElement("table");
    tableEl.classList.add("table", "table-striped");

    const tableHeadEl = document.createElement("thead");
    const headerRowEl = document.createElement("tr");

    headerRowEl.append(
      ...DISPLAYED_HEADERS.map((header) => {
        const tableHeaderEl = document.createElement("th");
        tableHeaderEl.scope = "col";
        tableHeaderEl.textContent = header;
        return tableHeaderEl;
      })
    );

    tableHeadEl.appendChild(headerRowEl);

    const tableBodyEl = document.createElement("tbody");
    tableBodyEl.append(
      ...summaries.map((summary, i) => {
        const tableRowEl = document.createElement("tr");
        const tableHeaderEl = document.createElement("th");
        tableHeaderEl.textContent = i.toString();
        tableHeaderEl.scope = "row";
        tableRowEl.append(
          tableHeaderEl,
          ...DISPLAYED_COLUMNS.map((header) => {
            const tableDataEl = document.createElement("td");
            tableDataEl.textContent = summary[header];
            return tableDataEl;
          })
        );
        return tableRowEl;
      })
    );

    tableEl.append(tableHeadEl, tableBodyEl);
    return tableEl;
  };

  const generateMarkingScript = (summaries) => `
const presentStudents = ${JSON.stringify(summaries.map(({ userName }) => splitKey(userName)))};
const nameTests = presentStudents.map((names) => names.map((name) => new RegExp(name, "i")));
const getAttendanceElements = () => 
  Array.from(document.querySelectorAll(".student-details-list .row:has(a)"))
  .map((row) => [row.querySelector("a"), row.querySelector(".dropdown")])
  .map(([nameLink, dropdown]) => {
    const name = nameLink.textContent;
    const options = Array.from(dropdown.querySelectorAll("[role=\\"option\\"] .text"));
    const presentOption = options.find((option) => option.textContent === "Present")
    const absentOption = options.find((option) => option.textContent === "Absent")
    const selectedOption = dropdown.querySelector("[role=\\"option\\"][class~=\\"active\\"] .text")
    return {
      name,
      dropdown,
      presentOption,
      absentOption,
      selectedOption: selectedOption.textContent
    }
  })
const markPresent = () => {
  getAttendanceElements()
    .filter(({name}) => nameTests
        .find((names, i) => {
          const perfectMatch = names.every((test) => test.test(name))
          if (perfectMatch) {
            return true;
          }
          const partialMatch = names.some((test) => test.test(name))
          if (partialMatch) {
            console.log("partial match", presentStudents[i], name)
          } else {
            console.log("no match", name)
          }
          return false;
        })
    )
    .forEach(({dropdown, presentOption}) => {
      dropdown.click();
      presentOption.click();
    })
}

const markAbsent = () => {
  getAttendanceElements()
    .filter(({name, selectedOption}) => (console.log(name, selectedOption), selectedOption === "None"))
    .forEach(({dropdown, absentOption}) => {
      console.log("Hey")
      dropdown.click();
      absentOption.click();
    })
}`;

  ignoredNamesEl.append(
    ...ignoredNames.map(
      (ignoredName, i) => createIgnoredNameInput(i, ignoredName)
    )
  );

  fileInputEl?.addEventListener("change", () => {
    fileInputEl.setCustomValidity("");
  });

  addIgnoredNameButtonEl.addEventListener("click", () => {
    const index = addIgnoredName("");
    ignoredNamesEl.appendChild(createIgnoredNameInput(index, ""));
  });

  inputFormEl.addEventListener("change", () => {
    inputFormEl.classList.remove('was-validated');
  });
  inputFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {

      const formData = new FormData(inputFormEl);

      const { headers, lines } = await parseCSV(formData.get("csvFile"));

      if (!EXPECTED_HEADERS.every((header, i) => header === headers[i])) {
        throw new Error("Unrecognized headers");
      }
      const entries = lines
        .map((line) => line.split(","))
        .map((row) => Object.fromEntries(
          headers.map((header, i) => [header, row[i]])
        ));

      entries.forEach((entry) => {
        entry.userName = entry.userName
          .split(" ")
          .map((name) => name.replace(/#/g, ""))
          .join(" ");
      });

      const ignoredNamesTests = ignoredNames
        .map((ignoredName) => new RegExp(ignoredName, "i"));

      const summaries = Array.from(
        collectByKey(entries, (entry) => entry.userEmail || entry.userName).values()
      )
        .map((entries) => ({
          userName: entries.find((entry) => entry.userName)?.userName,
          userEmail: entries.find((entry) => entry.userEmail)?.userEmail,
          joinTime: new Date(Math.min(...entries.map((entry) => new Date(entry.joinTime).getTime()))).toLocaleString(),
          leaveTime: new Date(Math.max(...entries.map((entry) => new Date(entry.leaveTime).getTime()))).toLocaleString(),
          duration: entries
            .map((entry) => Number.parseFloat(entry.duration))
            .reduce((sum, duration) => sum + duration, 0)
        }))
        .filter(({ userName }) => !ignoredNamesTests.some((regex) => regex.test(userName)));

      summaries.sort((a, b) => {
        const aDipped = a.duration < 60;
        const bDipped = b.duration < 60;
        if (aDipped && bDipped || !aDipped && !bDipped) return a.userName.localeCompare(b.userName);
        if (aDipped) return -1;
        else return 1;
      });
      const outputEl = getOutputEl();
      outputEl.innerHTML = "";

      const jsOutputButtonEl = document.createElement("button");
      jsOutputButtonEl.classList.add("btn", "btn-success");
      jsOutputButtonEl.textContent = "Copy Script";
      jsOutputButtonEl.addEventListener("click", () => {
        navigator.clipboard?.writeText(generateMarkingScript(summaries));
      });

      outputEl.append(jsOutputButtonEl, createSummaryTable(summaries));
    } catch (error) {
      if (error.message) {
        fileInputEl.setCustomValidity(error.message);
        errorEl.textContent = error.message;
      }
    }

    inputFormEl.classList.add('was-validated');
  });
})();