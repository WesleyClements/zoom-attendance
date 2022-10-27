(() => {
  const EXPECTED_HEADERS = ['userName', 'userEmail', 'joinTime', 'leaveTime', 'duration', 'attentivenessScore'];

  const inputFormEl = document.querySelector("form");

  const capitalize = (word) => word.charAt(0).toUpperCase() + word.substring(1);

  const getOutputEl = () => {
    const existingEl = document.querySelector("#output");
    if (existingEl) return existingEl;
    const newEl = document.createElement("div");
    newEl.id = "output";
    document.querySelector("main")?.append(newEl);
    return newEl;
  };

  if (!inputFormEl) {
    throw new Error("no input form");
  }

  inputFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(inputFormEl);

    const file = formData.get("csvFile");
    if (!(file instanceof File)) {
      throw new Error("invalid form data");
    }
    if (!file.name.endsWith(".csv")) {
      throw new Error("file must be a csv file");
    }
    const text = await file.text();

    const lines = text.split(/\r\n|\n/m);
    const headers = (lines.shift() || "")
      .split(",")
      .map((header) => header
        .split(" ")
        .map((word) => word.split("(")[0])
        .map((word, i) => i ? capitalize(word) : word.toLowerCase())
        .join("")
      );

    const entries = lines
      .map((line) => line.split(","))
      .map((row) => Object.fromEntries(
        headers.map((header, i) => [header, row[i]])
      ));

    if (!EXPECTED_HEADERS.every((header, i) => header === headers[i])) {
      throw new Error("unrecognized headers");
    }

    const filteredEntries = new Map();
    entries.forEach((entry) => {
      const id = entry.userEmail || entry.userName;
      if (!id) return;
      if (filteredEntries.has(id)) {
        filteredEntries.get(id).push(entry);
      } else {
        filteredEntries.set(id, [entry]);
      }
    });

    const summaries = [...filteredEntries].map(([, entries]) => ({
      userName: entries.find((entry) => entry.userName)?.userName,
      userEmail: entries.find((entry) => entry.userEmail)?.userEmail,
      joinTime: new Date(Math.min(...entries.map((entry) => new Date(entry.joinTime).getTime()))).toLocaleString(),
      leaveTime: new Date(Math.max(...entries.map((entry) => new Date(entry.leaveTime).getTime()))).toLocaleString(),
      duration: entries
        .map((entry) => Number.parseFloat(entry.duration))
        .reduce((sum, duration) => sum + duration, 0)
    }));

    const outputEl = getOutputEl();

    const tableEl = document.createElement("table");
    tableEl.classList.add("table", "table-striped");

    const tableHeadEl = document.createElement("thead");
    const headerRowEl = document.createElement("tr");

    headerRowEl.append(
      ...headers
        .slice(0, -1)
        .map((header) => {
          const tableHeaderEl = document.createElement("th");
          tableHeaderEl.scope = "col";
          tableHeaderEl.textContent = header;
          return tableHeaderEl;
        })
    );
    tableHeadEl.appendChild(headerRowEl);

    const tableBodyEl = document.createElement("tbody");
    tableBodyEl.append(
      ...summaries.map((summary) => {
        const tableRowEl = document.createElement("tr");
        tableRowEl.append(
          ...headers
            .slice(0, -1)
            .map((header) => {
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
  });
})();