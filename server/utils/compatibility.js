const compatibilityChart = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
};

/**
 * Returns a list of compatible donor blood groups for a given required blood group.
 * Example: To receive 'A+', compatible donors are 'A+', 'A-', 'O+', 'O-'
 * wait... the prompt has rules: O- can donate to all, etc.
 * The chart above tells who they can DONATE TO.
 * Let's reverse it to see who can DONATE TO the REQUIRED GROUP.
 */
function getCompatibleDonors(requiredGroup) {
    const compatibleDonors = [];
    for (const [donorGroup, canDonateTo] of Object.entries(compatibilityChart)) {
        if (canDonateTo.includes(requiredGroup)) {
            compatibleDonors.push(donorGroup);
        }
    }
    return compatibleDonors;
}

function getDonationTargets(donorGroup) {
    return compatibilityChart[donorGroup] || [];
}

module.exports = { getCompatibleDonors, getDonationTargets };
