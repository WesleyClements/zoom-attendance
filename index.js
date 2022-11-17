(() => {
  const EXPECTED_HEADERS = ['userName', 'userEmail', 'joinTime', 'leaveTime', 'duration', 'attentivenessScore'];
  const DISPLAYED_HEADERS = ["#", "Name", "Joined At", "Left At", "Duration (Minutes)"];
  const DISPLAYED_COLUMNS = ['userName', 'joinTime', 'leaveTime', 'duration'];

  const KEY_SEPARATORS = [" ", "."];

  const inputFormEl = document.querySelector("form");

  if (!inputFormEl) {
    throw new Error("no input form");
  }

  /** @type {HTMLInputElement | null} */
  const fileInputEl = inputFormEl.querySelector("input[name=\"csvFile\"]");
  const errorEl = inputFormEl.querySelector("input[name=\"csvFile\"] + .invalid-feedback");

  if (!fileInputEl) {
    throw new Error("no file input");
  }
  if (!errorEl) {
    throw new Error("no file input error");
  }

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

  const displaySummaries = (summaries) => {
    const outputEl = getOutputEl();

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

    outputEl.innerHTML = "";
    outputEl.appendChild(tableEl);
  };

  fileInputEl?.addEventListener("change", () => {
    fileInputEl.setCustomValidity("");
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
        }));

      summaries.sort((a, b) => {
        const aDipped = a.duration < 60;
        const bDipped = b.duration < 60;
        if (aDipped && bDipped || !aDipped && !bDipped) return a.userName.localeCompare(b.userName);
        if (aDipped) return -1;
        else return 1;
      });

      displaySummaries(summaries);
    } catch (error) {
      if (error.message) {
        fileInputEl.setCustomValidity(error.message);
        errorEl.textContent = error.message;
      }
    }

    inputFormEl.classList.add('was-validated');
  });
})();