// Site UI and Control Module
// Handles all UI interactions, data loading, and result display

let structuresData = {};
let filteredStructures = [];
let currentLevels = {};

// Load data from JSON
async function loadData() {
    try {
        const response = await fetch('data/structures_database.json');
        if (!response.ok) {
            throw new Error('Failed to load structures database');
        }
        structuresData = await response.json();
        filteredStructures = Object.keys(structuresData).sort();
        initializeUI();
        loadSavedLevels();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load structures database. Make sure structures_database.json is in the same directory.');
    }
}

function initializeUI() {
    // Initialize current levels
    for (let structure of filteredStructures) {
        currentLevels[structure] = 1;
    }

    // Populate target structure dropdown
    const targetSelect = document.getElementById('targetStructure');
    targetSelect.innerHTML = '<option value="">Select structure...</option>';
    for (let structure of filteredStructures) {
        const option = document.createElement('option');
        option.value = structure;
        option.textContent = structure;
        targetSelect.appendChild(option);
    }

    renderStructureInputs(filteredStructures);
}

function renderStructureInputs(structures) {
    const container = document.getElementById('structureInputs');
    container.innerHTML = '';

    for (let structure of structures) {
        const level = currentLevels[structure] || 1;
        const maxLevel = Object.keys(structuresData[structure].levels).length;

        const group = document.createElement('div');
        group.className = 'structure-input-group';
        group.innerHTML = `
            <label>${structure}</label>
            <div class="input-wrapper">
                <input type="number" 
                       min="1" 
                       max="${maxLevel}" 
                       value="${level}" 
                       onchange="updateLevel('${structure}', this.value)"
                       onkeyup="updateLevel('${structure}', this.value)">
                <span style="color: #999; font-size: 12px;">/ ${maxLevel}</span>
            </div>
        </div>`;
        container.appendChild(group);
    }
}

function updateLevel(structure, value) {
    const numValue = parseInt(value) || 1;
    const maxLevel = Object.keys(structuresData[structure].levels).length;
    const clampedValue = Math.max(1, Math.min(maxLevel, numValue));

    currentLevels[structure] = clampedValue;
    saveLevels();
}

function saveLevels() {
    localStorage.setItem('structureLevels', JSON.stringify(currentLevels));
    showSaveIndicator();
}

function loadSavedLevels() {
    const saved = localStorage.getItem('structureLevels');
    if (saved) {
        try {
            currentLevels = JSON.parse(saved);
            renderStructureInputs(filteredStructures);
        } catch (error) {
            console.error('Error loading saved levels:', error);
        }
    }
}

function resetAllLevels() {
    if (confirm('Are you sure you want to reset all structure levels to 1?')) {
        for (let structure of filteredStructures) {
            currentLevels[structure] = 1;
        }
        saveLevels();
        renderStructureInputs(filteredStructures);
    }
}

function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function updateTargetLevels() {
    const targetStructure = document.getElementById('targetStructure').value;
    const targetLevelInput = document.getElementById('targetLevel');

    if (targetStructure) {
        const maxLevel = Object.keys(structuresData[targetStructure].levels).length;
        targetLevelInput.max = maxLevel;
        targetLevelInput.placeholder = `1 - ${maxLevel}`;
    } else {
        targetLevelInput.value = '';
        targetLevelInput.placeholder = 'Select a structure first';
    }
}

function calculateResources() {
    const targetStructure = document.getElementById('targetStructure').value;
    const targetLevel = parseInt(document.getElementById('targetLevel').value);

    if (!targetStructure || !targetLevel) {
        showError('Please select a target structure and level');
        return;
    }

    if (targetLevel < 1) {
        showError('Level must be at least 1');
        return;
    }

    const maxLevel = Object.keys(structuresData[targetStructure].levels).length;
    if (targetLevel > maxLevel) {
        showError(`Maximum level for ${targetStructure} is ${maxLevel}`);
        return;
    }

    const currentLevel = currentLevels[targetStructure] || 1;
    const constructionSpeedBonus = parseFloat(document.getElementById('constructionSpeedBonus').value) || 0;

    // Use the calculator module
    const result = CalculatorModule.calculateResourcesRecursive(
        targetStructure,
        targetLevel,
        currentLevel,
        constructionSpeedBonus,
        structuresData,
        currentLevels
    );
    displayResults(result, targetStructure, targetLevel, currentLevel, constructionSpeedBonus);
}

function renderDependencyTree(tree, resourceOrder, depth = 0) {
    let html = '';
    const indent = depth * 20;

    if (tree.targetLevel <= tree.currentLevel) {
        return html;
    }

    html += `<div style="margin-left: ${indent}px; margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #667eea;">`;
    html += `<div class="dependency-name" style="margin-bottom: 10px;">${tree.structure} Level ${tree.currentLevel} → ${tree.targetLevel}</div>`;
    // Show costs for this upgrade
    html += '<div class="dependency-resources" style="margin-bottom: 10px;">';
    let hasCosts = false;
    for (let resource of resourceOrder) {
        const amount = tree.costs[resource] || 0;
        if (amount > 0) {
            hasCosts = true;
            html += `<div class="dependency-resource"><strong>${resource}:</strong> ${amount.toLocaleString()}</div>`;
        }
    }
    if (!hasCosts) {
        html += '<div class="dependency-resource" style="color: #999;">No additional costs</div>';
    }
    html += '</div>';

    // Show upgrade time for this dependency
    if (tree.time > 0) {
        html += `<div style="padding: 8px; background: rgba(255,255,255,0.6); border-radius: 3px; text-align: center; margin-bottom: 10px;">`;
        html += `<span style="color: #333; font-weight: 600; font-size: 13px;">Build Time: ${CalculatorModule.formatTime(tree.time)}</span>`;
        html += `</div>`;
    }

    // Show nested dependencies
    if (tree.children && tree.children.length > 0) {
        html += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">';
        html += '<div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 10px;">Required dependencies:</div>';
        for (let child of tree.children) {
            html += renderDependencyTree(child, resourceOrder, depth + 1);
        }
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function displayResults(result, targetStructure, targetLevel, currentLevel, constructionSpeedBonus = 0) {
    const container = document.getElementById('resultsContainer');
    const content = document.getElementById('resultsContent');

    const resourceOrder = ['food', 'metal', 'wood', 'energy', 'tech'];

    let html = '';

    // Display upgrade range
    html += '<div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px; border-left: 4px solid #667eea;">';
    html += `<p style="color: #333; font-weight: 600; margin: 0;">Upgrade Path: ${targetStructure} Level ${currentLevel} → Level ${targetLevel}</p>`;
    html += '</div>';

    // Display individual structure cost
    html += '<div style="margin-bottom: 30px;">';
    html += `<h3 style="color: #333; margin-bottom: 15px; font-size: 16px;">Cost to Upgrade ${targetStructure} (Levels ${currentLevel + 1} - ${targetLevel})</h3>`;
    html += '<div class="resource-display">';
    for (let resource of resourceOrder) {
        const amount = result.individualCosts[resource] || 0;
        const displayAmount = amount.toLocaleString();
        html += `
            <div class="resource-item ${resource}">
                <div class="resource-label">${resource}</div>
                <div class="resource-value">${displayAmount}</div>
            </div>
        `;
    }
    html += '</div>';
    // Show upgrade time for individual structure
    if (result.individualTimes > 0) {
        html += `<div style="margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px; text-align: center;">`;
        html += `<span style="color: #666; font-weight: 600;">Upgrade Time: ${CalculatorModule.formatTime(result.individualTimes)}</span>`;
        html += `</div>`;
    }
    html += '</div>';

    // Display dependency costs
    if (result.dependencies && result.dependencies.length > 0) {
        html += '<div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #fa709a;">';
        html += '<h3 style="color: #333; margin-bottom: 15px; font-size: 16px;">Cost for Required Dependencies</h3>';
        html += '<div class="resource-display">';
        for (let resource of resourceOrder) {
            const amount = result.dependencyCosts[resource] || 0;
            const displayAmount = amount.toLocaleString();
            html += `
                <div class="resource-item ${resource}">
                    <div class="resource-label">${resource}</div>
                    <div class="resource-value">${displayAmount}</div>
                </div>
            `;
        }
        html += '</div>';
        // Show total dependency time
        if (result.dependencyTimes > 0) {
            html += `<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 5px; text-align: center;">`;
            html += `<span style="color: #666; font-weight: 600;">Dependency Build Time: ${CalculatorModule.formatTime(result.dependencyTimes)}</span>`;
            html += `</div>`;
        }
        html += '</div>';
    }

    // Display total cost
    html += '<div style="margin-bottom: 30px; padding: 20px; background: #f0f0f0; border-radius: 5px; border-left: 4px solid #667eea;">';
    html += '<h3 style="color: #333; margin-bottom: 15px; font-size: 16px;">Total Cumulative Cost</h3>';
    html += '<div class="resource-display">';
    for (let resource of resourceOrder) {
        const amount = result.totalCosts[resource] || 0;
        const displayAmount = amount.toLocaleString();
        html += `
            <div class="resource-item ${resource}">
                <div class="resource-label">${resource}</div>
                <div class="resource-value">${displayAmount}</div>
            </div>
        `;
    }
    html += '</div>';
    // Show total time
    if (result.totalTime > 0) {
        html += `<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 5px; text-align: center;">`;
        html += `<span style="color: #333; font-weight: 600;">Total Build Time: ${CalculatorModule.formatTime(result.totalTime)}</span>`;
        html += `</div>`;
    }
    html += '</div>';

    // Display detailed dependencies breakdown with full tree
    if (result.dependencies && result.dependencies.length > 0) {
        html += '<div class="dependencies-section">';
        html += '<h3>Upgrade Path Details</h3>';
        html += '<p style="color: #666; font-size: 14px; margin-bottom: 15px;">Complete dependency chain required for the upgrade:</p>';

        // Build and render the dependency tree
        const currentLevel = currentLevels[targetStructure] || 1;
        const tree = CalculatorModule.buildDependencyTree(
            targetStructure,
            targetLevel,
            currentLevel,
            structuresData,
            currentLevels,
            constructionSpeedBonus
        );

        // Show main structure upgrade
        html += '<div style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-radius: 5px; border-left: 4px solid #43e97b;">';
        html += `<div class="dependency-name" style="margin-bottom: 10px;">${targetStructure} Level ${currentLevel} → ${targetLevel}</div>`;
        html += '<div class="dependency-resources">';
        let hasMainCosts = false;
        for (let resource of resourceOrder) {
            const amount = result.individualCosts[resource] || 0;
            if (amount > 0) {
                hasMainCosts = true;
                html += `<div class="dependency-resource"><strong>${resource}:</strong> ${amount.toLocaleString()}</div>`;
            }
        }
        if (!hasMainCosts) {
            html += '<div class="dependency-resource" style="color: #999;">No costs</div>';
        }
        html += '</div>';
        // Show main structure upgrade time
        if (result.individualTimes > 0) {
            html += `<div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.6); border-radius: 3px; text-align: center;">`;
            html += `<span style="color: #333; font-weight: 600; font-size: 13px;">Build Time: ${CalculatorModule.formatTime(result.individualTimes)}</span>`;
            html += `</div>`;
        }
        html += '</div>';

        // Show dependency tree
        if (tree.children && tree.children.length > 0) {
            html += '<div style="margin-top: 20px; padding: 15px; background: #fff3e0; border-radius: 5px; border-left: 4px solid #fa709a;">';
            html += '<div style="font-weight: 600; color: #333; margin-bottom: 15px;">Required Dependencies:</div>';
            for (let child of tree.children) {
                html += renderDependencyTree(child, resourceOrder, 0);
            }
            html += '</div>';
        }

        html += '</div>';
    }

    content.innerHTML = html;
    container.style.display = 'block';
}

// Search functionality
document.getElementById('structureSearch').addEventListener('input', function (e) {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm === '') {
        renderStructureInputs(filteredStructures);
    } else {
        const filtered = filteredStructures.filter(s =>
            s.toLowerCase().includes(searchTerm)
        );
        renderStructureInputs(filtered);
    }
});

// Initialize on page load
window.addEventListener('load', loadData);
