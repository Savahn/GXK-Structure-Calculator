/**
 * Calculator Module - Core calculation logic for resource upgrades
 * Can be used in both Node.js and browser environments
 */

// Export for both Node.js and browser
const CalculatorModule = (function () {
    'use strict';

    /**
     * Parse requirement string format "Level X StructureName"
     * @param {string} requirement - The requirement string to parse
     * @returns {Object|null} - Object with structure name and required level, or null if invalid
     */
    function parseRequirement(requirement) {
        const match = requirement.match(/Level (\d+)\s+(.+)/);
        if (match) {
            return { structure: match[2], level: parseInt(match[1]) };
        }
        return null;
    }

    /**
     * Format seconds into human-readable time format
     * @param {number} seconds - Total seconds to format
     * @returns {string} - Formatted time string (e.g., "2d 5h 30m")
     */
    function formatTime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 && days === 0 && hours === 0) parts.push(`${secs}s`);

        return parts.length > 0 ? parts.join(' ') : '0s';
    }

    /**
     * Recursively calculate resources and time needed for an upgrade
     * Handles complex dependency chains and consolidates duplicate dependencies
     * 
     * @param {string} structure - The structure to upgrade
     * @param {number} targetLevel - The target level to upgrade to
     * @param {number} currentLevel - The current level of the structure
     * @param {number} constructionSpeedBonus - Construction speed bonus percentage
     * @param {Object} structuresData - The structures database
     * @param {Object} currentLevels - Current levels of all structures
     * @param {Set} visited - Set to track already processed dependencies (for deduplication)
     * @param {Object} visitedLevels - Object to track visited levels
     * @returns {Object} - Result object with costs, times, and dependencies
     */
    function calculateResourcesRecursive(
        structure,
        targetLevel,
        currentLevel = null,
        constructionSpeedBonus = 0,
        structuresData = {},
        currentLevels = {},
        visited = new Set(),
        visitedLevels = {}
    ) {
        // Use the actual current level if not specified
        if (currentLevel === null) {
            currentLevel = currentLevels[structure] || 1;
        }

        const result = {
            individualCosts: {},
            dependencyCosts: {},
            totalCosts: {},
            dependencies: [],
            individualTimes: 0,
            dependencyTimes: 0,
            totalTime: 0
        };

        // Check if structure exists
        if (!structuresData[structure]) {
            return result;
        }

        // If target is not higher than current, no upgrade needed
        if (targetLevel <= currentLevel) {
            return result;
        }

        // Convert construction speed bonus from percentage to decimal (e.g., 50% = 0.5)
        const speedMultiplier = constructionSpeedBonus / 100;

        // FIRST PASS: Collect all dependencies across ALL levels being upgraded
        const allDependencies = {};
        for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
            if (!structuresData[structure].levels[lvl]) {
                continue;
            }

            const levelData = structuresData[structure].levels[lvl];

            // Collect requirements for this level
            if (levelData.requirements) {
                for (let requirement of levelData.requirements) {
                    const parsed = parseRequirement(requirement);
                    if (parsed) {
                        // Track the maximum level needed for this dependency across all levels
                        if (!allDependencies[parsed.structure] || parsed.level > allDependencies[parsed.structure]) {
                            allDependencies[parsed.structure] = parsed.level;
                        }
                    }
                }
            }
        }

        // SECOND PASS: Calculate costs and time for the main structure
        for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
            if (!structuresData[structure].levels[lvl]) {
                continue;
            }

            const levelData = structuresData[structure].levels[lvl];

            // Add this level's individual costs
            if (levelData.costs) {
                for (let [resource, amount] of Object.entries(levelData.costs)) {
                    result.individualCosts[resource] = (result.individualCosts[resource] || 0) + amount;
                    result.totalCosts[resource] = (result.totalCosts[resource] || 0) + amount;
                }
            }

            // Add this level's upgrade time
            if (levelData.upgrade_time) {
                const upgradeTime = levelData.upgrade_time / (1 + speedMultiplier);
                result.individualTimes += upgradeTime;
                result.totalTime += upgradeTime;
            }
        }

        // THIRD PASS: Process dependencies only once, at their maximum required level
        for (let [depStructure, maxLevel] of Object.entries(allDependencies)) {
            const depCurrentLevel = currentLevels[depStructure] || 1;

            // Only process this dependency if it needs to be upgraded
            // (i.e., required level is higher than current level)
            if (maxLevel > depCurrentLevel) {
                const depKey = `${depStructure}-${maxLevel}`;

                // Check if this dependency has already been calculated
                if (!visited.has(depKey)) {
                    visited.add(depKey);

                    const depResult = calculateResourcesRecursive(
                        depStructure,
                        maxLevel,
                        depCurrentLevel,
                        constructionSpeedBonus,
                        structuresData,
                        currentLevels,
                        visited,
                        visitedLevels
                    );

                    // Add dependency resources
                    for (let [resource, amount] of Object.entries(depResult.totalCosts)) {
                        result.dependencyCosts[resource] = (result.dependencyCosts[resource] || 0) + amount;
                        result.totalCosts[resource] = (result.totalCosts[resource] || 0) + amount;
                    }

                    // Add dependency times
                    result.dependencyTimes += depResult.totalTime;
                    result.totalTime += depResult.totalTime;

                    // Add to dependency list with level info
                    result.dependencies.push({
                        name: depStructure,
                        level: maxLevel,
                        resources: depResult.totalCosts,
                        time: depResult.totalTime
                    });
                }
            }
        }

        return result;
    }

    /**
     * Build a dependency tree for visualization
     * @param {string} structure - The structure name
     * @param {number} targetLevel - The target level
     * @param {number} currentLevel - The current level
     * @param {Object} structuresData - The structures database
     * @param {Object} currentLevels - Current levels of all structures
     * @param {number} constructionSpeedBonus - Construction speed bonus percentage
     * @param {Set} visited - Set to track visited nodes
     * @returns {Object} - Tree structure representing dependencies
     */
    function buildDependencyTree(
        structure,
        targetLevel,
        currentLevel = null,
        structuresData = {},
        currentLevels = {},
        constructionSpeedBonus = 0,
        visited = new Set()
    ) {
        if (currentLevel === null) {
            currentLevel = currentLevels[structure] || 1;
        }

        const tree = {
            structure: structure,
            currentLevel: currentLevel,
            targetLevel: targetLevel,
            costs: {},
            time: 0,
            children: []
        };

        // If no upgrade needed, return empty tree
        if (targetLevel <= currentLevel) {
            return tree;
        }

        // Calculate costs and time for this structure's upgrade
        const speedMultiplier = constructionSpeedBonus / 100;
        for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
            if (structuresData[structure] && structuresData[structure].levels[lvl]) {
                const levelData = structuresData[structure].levels[lvl];
                if (levelData.costs) {
                    for (let [resource, amount] of Object.entries(levelData.costs)) {
                        tree.costs[resource] = (tree.costs[resource] || 0) + amount;
                    }
                }
                if (levelData.upgrade_time) {
                    const adjustedTime = levelData.upgrade_time / (1 + speedMultiplier);
                    tree.time += adjustedTime;
                }

                // Process dependencies for this level
                if (levelData.requirements) {
                    for (let requirement of levelData.requirements) {
                        const parsed = parseRequirement(requirement);
                        if (parsed) {
                            const depCurrentLevel = currentLevels[parsed.structure] || 1;

                            // Only add to tree if upgrade is needed
                            if (parsed.level > depCurrentLevel) {
                                const depKey = `${parsed.structure}-${parsed.level}`;

                                // Check if we haven't already added this exact dependency
                                const alreadyExists = tree.children.some(child =>
                                    child.structure === parsed.structure && child.targetLevel === parsed.level
                                );

                                if (!alreadyExists) {
                                    const childTree = buildDependencyTree(
                                        parsed.structure,
                                        parsed.level,
                                        depCurrentLevel,
                                        structuresData,
                                        currentLevels,
                                        constructionSpeedBonus,
                                        new Set(visited)
                                    );
                                    tree.children.push(childTree);
                                }
                            }
                        }
                    }
                }
            }
        }

        return tree;
    }

    // Public API
    return {
        parseRequirement,
        formatTime,
        calculateResourcesRecursive,
        buildDependencyTree
    };
})();

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculatorModule;
}
