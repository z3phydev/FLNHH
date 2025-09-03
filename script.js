// Global variables
let speed = 5; // Default 5 seconds
let app;

// Initialize speed slider
document.addEventListener('DOMContentLoaded', function() {
    const speedSlider = document.getElementById("speed_slider");
    const speedDisplay = document.getElementById("speed_display");

    // Set initial values - slider at 0 represents 5 seconds
    speedSlider.value = 0;
    updateSpeedDisplay(0);

    speedSlider.oninput = function() {
        const value = parseFloat(this.value);
        updateSpeedDisplay(value);
    };

    function updateSpeedDisplay(value) {
        if (value === 0) {
            speed = 5; // 5 seconds
            speedDisplay.textContent = "5 seconds";
        } else {
            // Convert hours to seconds: hours * 3600
            speed = value * 3600;
            if (value < 1) {
                const minutes = Math.round(value * 60);
                speedDisplay.textContent = `${minutes} minutes`;
            } else {
                speedDisplay.textContent = `${value} hours`;
            }
        }
    }
});

// Settings button functionality
document.getElementById("settings_button").addEventListener("click", () => {
    document.getElementById("settings").showModal();
});

// Close settings on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.getElementById("settings").close();
    }
});

// Utility functions
function secondsToString(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
        const minutes = Math.round(seconds / 60);
        return `${minutes} minutes`;
    } else if (seconds < 86400) {
        const hours = Math.round(seconds / 3600);
        return `${hours} hours`;
    } else {
        const days = Math.round(seconds / 86400);
        return `${days} days`;
    }
}

function setCheckboxes(node, state) {
    const container = document.getElementById(node);
    if (container) {
        for (const checkbox of container.querySelectorAll("input[type=checkbox]")) {
            checkbox.checked = state;
        }
    }
}

// Async pool utility for managing concurrent requests
async function asyncPool(array, poolSize) {
    const result = [];
    const pool = [];

    function leavePool(e) {
        pool.splice(pool.indexOf(e), 1);
    }

    for (const item of array) {
        const p = Promise.resolve(item());
        result.push(p);
        const e = p.then(() => leavePool(e));
        pool.push(e);
        if (pool.length >= poolSize) await Promise.race(pool);
    }
    return Promise.all(result);
}

// Task completer class
class TaskCompleter {
    constructor(token, task, ietf) {
        this.token = token;
        this.task = task;
        this.mode = this.getTaskType();
        this.toLanguage = ietf;
        this.homeworkId = task.base[0];
        this.catalogUid = task.catalog_uid || task.base[task.base.length - 1];
        this.relModuleUid = task.rel_module_uid;
        this.gameUid = task.game_uid;
        this.gameType = task.type;
    }

    async complete() {
        const answers = await this.getData();
        if (answers && answers.length > 0) {
            await this.sendAnswers(answers);
        }
    }

    async getData() {
        let vocabs;
        switch (this.mode) {
            case "sentence":
                vocabs = await this.getSentences();
                break;
            case "verbs":
                vocabs = await this.getVerbs();
                break;
            case "phonics":
                vocabs = await this.getPhonics();
                break;
            case "exam":
                vocabs = await this.getExam();
                break;
            default:
                vocabs = await this.getVocabs();
        }
        return vocabs;
    }

    async sendAnswers(vocabs) {
        if (!vocabs || vocabs.length === 0) {
            console.log("No vocabs found, skipping sending answers.");
            return;
        }

        const data = {
            moduleUid: this.catalogUid,
            gameUid: this.gameUid,
            gameType: this.gameType,
            isTest: true,
            toietf: this.toLanguage,
            fromietf: "en-US",
            score: vocabs.length * 200,
            correctVocabs: vocabs.map((x) => x.uid).join(","),
            incorrectVocabs: [],
            homeworkUid: this.homeworkId,
            isSentence: this.mode === "sentence",
            isALevel: false,
            isVerb: this.mode === "verbs",
            verbUid: this.mode === "verbs" ? this.catalogUid : "",
            phonicUid: this.mode === "phonics" ? this.catalogUid : "",
            sentenceScreenUid: this.mode === "sentence" ? 100 : "",
            sentenceCatalogUid: this.mode === "sentence" ? this.catalogUid : "",
            grammarCatalogUid: this.catalogUid,
            isGrammar: false,
            isExam: this.mode === "exam",
            correctStudentAns: "",
            incorrectStudentAns: "",
            timeStamp: Math.floor(speed + ((Math.random() - 0.5) / 10) * speed) * 1000,
            vocabNumber: vocabs.length,
            rel_module_uid: this.task.rel_module_uid,
            dontStoreStats: true,
            product: "secondary",
            token: this.token,
        };

        const response = await this.callLnut("gameDataController/addGameScore", data);
        return response;
    }

    async getVerbs() {
        const vocabs = await this.callLnut("verbTranslationController/getVerbTranslations", {
            verbUid: this.catalogUid,
            toLanguage: this.toLanguage,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.verbTranslations;
    }

    async getPhonics() {
        const vocabs = await this.callLnut("phonicsController/getPhonicsData", {
            phonicCatalogUid: this.catalogUid,
            toLanguage: this.toLanguage,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.phonics;
    }

    async getSentences() {
        const vocabs = await this.callLnut("sentenceTranslationController/getSentenceTranslations", {
            catalogUid: this.catalogUid,
            toLanguage: this.toLanguage,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.sentenceTranslations;
    }

    async getExam() {
        const vocabs = await this.callLnut("examTranslationController/getExamTranslationsCorrect", {
            gameUid: this.gameUid,
            examUid: this.catalogUid,
            toLanguage: this.toLanguage,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.examTranslations;
    }

    async getVocabs() {
        const vocabs = await this.callLnut("vocabTranslationController/getVocabTranslations", {
            "catalogUid[]": this.catalogUid,
            toLanguage: this.toLanguage,
            fromLanguage: "en-US",
            token: this.token,
        });
        return vocabs.vocabTranslations;
    }

    async callLnut(url, data) {
        const urlData = new URLSearchParams(data).toString();
        const response = await fetch(`https://api.languagenut.com/${url}?${urlData}`);
        return await response.json();
    }

    getTaskType() {
        if (this.task.gameLink.includes("sentenceCatalog")) return "sentence";
        if (this.task.gameLink.includes("verbUid")) return "verbs";
        if (this.task.gameLink.includes("phonicCatalogUid")) return "phonics";
        if (this.task.gameLink.includes("examUid")) return "exam";
        return "vocabs";
    }
}

// Main application class
class ClientApplication {
    constructor() {
        this.usernameBox = document.getElementById("username_input");
        this.passwordBox = document.getElementById("password_input");
        this.moduleTranslations = [];
        this.displayTranslations = [];
        this.homeworks = [];
        this.token = null;
    }

    hideAll() {
        const overlays = document.getElementsByClassName("overlay");
        for (let overlay of overlays) {
            overlay.classList.remove("active");
        }
    }

    showBox(id) {
        document.getElementById(id).classList.add("active");
    }

    hideBox(id) {
        document.getElementById(id).classList.remove("active");
    }

    async callLnut(url, data) {
        const urlData = new URLSearchParams(data).toString();
        const response = await fetch(`https://api.languagenut.com/${url}?${urlData}`);
        return await response.json();
    }

    main() {
        this.showBox("login");
        document.getElementById("login_btn").onclick = async () => {
            const response = await this.callLnut("loginController/attemptLogin", {
                username: this.usernameBox.value,
                pass: this.passwordBox.value,
            });
            this.token = response.newToken;
            if (this.token) {
                this.onLogIn();
            } else {
                alert("Login failed. Please check your credentials.");
            }
        };
    }

    onLogIn() {
        this.hideBox("login");
        this.showBox("hw_panel");
        this.showBox("log_panel");

        document.getElementById("do_hw").onclick = () => {
            this.doHomeworks();
        };

        this.getModuleTranslations();
        this.getDisplayTranslations();
        this.displayHomeworks();
    }

    getTaskName(task) {
        let name = task.verb_name;

        if (task.module_translations) {
            name = this.moduleTranslations[task.module_translations[0]];
        }

        if (task.module_translation) {
            name = this.moduleTranslations[task.module_translation];
        }

        return name || "Unknown Task";
    }

    async displayHomeworks() {
        const homeworks = await this.getHomeworks();
        const panel = document.getElementById("hw_container");
        panel.innerHTML = "";
        this.homeworks = homeworks.homework;
        this.homeworks.reverse();

        const selectAllButton = document.getElementById("selectall");
        selectAllButton.onclick = function() {
            const checkboxes = document.getElementsByName("boxcheck");
            for (const checkbox of checkboxes) {
                checkbox.checked = this.checked;
            }
        };

        let hwIdx = 0;
        for (const homework of this.homeworks) {
            const { hwName, hwDisplay } = this.createHomeworkElements(homework, hwIdx);
            panel.appendChild(hwName);
            panel.appendChild(hwDisplay);
            hwIdx++;
        }
    }

    createHomeworkElements(homework, hwIdx) {
        const hwCheckbox = document.createElement("input");
        hwCheckbox.type = "checkbox";
        hwCheckbox.name = "boxcheck";
        hwCheckbox.onclick = function() {
            setCheckboxes(this.parentNode.nextElementSibling.id, this.checked);
        };

        const hwName = document.createElement("div");
        hwName.innerHTML = `<strong>${homework.name}</strong>`;
        hwName.prepend(hwCheckbox);
        hwName.style.marginBottom = "0.5rem";

        const hwDisplay = document.createElement("div");
        hwDisplay.id = `hw${homework.id}`;
        hwDisplay.style.marginLeft = "1.5rem";
        hwDisplay.style.marginBottom = "1rem";

        let idx = 0;
        for (const task of homework.tasks) {
            const { taskSpan, taskCheckbox, taskDisplay } = this.createTaskElements(task, hwIdx, idx);
            taskSpan.appendChild(taskCheckbox);
            taskSpan.appendChild(taskDisplay);
            hwDisplay.appendChild(taskSpan);
            idx++;
        }

        return { hwName, hwDisplay };
    }

    createTaskElements(task, hwIdx, idx) {
        const taskCheckbox = document.createElement("input");
        taskCheckbox.type = "checkbox";
        taskCheckbox.name = "boxcheck";
        taskCheckbox.id = `${hwIdx}-${idx}`;

        const taskDisplay = document.createElement("label");
        taskDisplay.htmlFor = taskCheckbox.id;
        const percentage = task.gameResults ? task.gameResults.percentage : "-";
        taskDisplay.innerHTML = `${this.displayTranslations[task.translation]} - ${this.getTaskName(task)} (${percentage}%)`;

        const taskSpan = document.createElement("span");
        taskSpan.classList.add("task");

        return { taskSpan, taskCheckbox, taskDisplay };
    }

    async doHomeworks() {
        const checkboxes = document.querySelectorAll(".task > input[type=checkbox]:checked");
        const logs = document.getElementById("log_container");
        logs.innerHTML = `<strong>Processing ${checkboxes.length} tasks...</strong><br>`;

        const progressBar = document.getElementById("hw_bar");
        let progress = 0;
        progressBar.style.width = "0%";

        const funcs = [];
        let taskId = 1;

        for (const checkbox of checkboxes) {
            const parts = checkbox.id.split("-");
            const task = this.homeworks[parts[0]].tasks[parts[1]];
            const taskCompleter = new TaskCompleter(
                this.token,
                task,
                this.homeworks[parts[0]].languageCode
            );

            funcs.push(() => (async (id) => {
                try {
                    const answers = await taskCompleter.getData();
                    if (!answers || answers.length === 0) {
                        logs.innerHTML += `<div>Task ${id}: No answers found, skipping...</div>`;
                        return;
                    }

                    logs.innerHTML += `<div><strong>Task ${id}:</strong> Fetched ${answers.length} vocabs</div>`;
                    logs.innerHTML += `<div class="json-small">${JSON.stringify(answers.slice(0, 3))}${answers.length > 3 ? '...' : ''}</div>`;

                    progress += 1;
                    progressBar.style.width = `${(progress / checkboxes.length) * 50}%`;

                    const result = await taskCompleter.sendAnswers(answers);
                    logs.innerHTML += `<div><strong>Task ${id}:</strong> Completed, scored ${result.score}</div>`;
                    logs.innerHTML += `<div class="json-small">Status: ${result.status || 'Success'}</div>`;

                    progress += 1;
                    progressBar.style.width = `${(progress / checkboxes.length) * 50}%`;
                } catch (error) {
                    logs.innerHTML += `<div><strong>Task ${id}:</strong> Error - ${error.message}</div>`;
                    console.error(`Task ${id} error:`, error);
                }

                logs.scrollTop = logs.scrollHeight;
            })(taskId++));
        }

        try {
            await asyncPool(funcs, 5);
            logs.innerHTML += `<div><strong>All tasks completed!</strong></div>`;
            progressBar.style.width = "100%";
            setTimeout(() => this.displayHomeworks(), 1000);
        } catch (error) {
            logs.innerHTML += `<div><strong>Error:</strong> ${error.message}</div>`;
            console.error("Homework completion error:", error);
        }
    }

    async getDisplayTranslations() {
        try {
            const response = await this.callLnut("publicTranslationController/getTranslations", {});
            this.displayTranslations = response.translations;
        } catch (error) {
            console.error("Error getting display translations:", error);
            this.displayTranslations = {};
        }
    }

    async getModuleTranslations() {
        try {
            const response = await this.callLnut("translationController/getUserModuleTranslations", {
                token: this.token,
            });
            this.moduleTranslations = response.translations;
        } catch (error) {
            console.error("Error getting module translations:", error);
            this.moduleTranslations = {};
        }
    }

    async getHomeworks() {
        return await this.callLnut("assignmentController/getViewableAll", {
            token: this.token,
        });
    }
}

// Initialize application
app = new ClientApplication();
app.main();