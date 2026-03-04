const donorToRecipientMap = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

const getRecipientGroupsForDonor = (donorBloodGroup) => donorToRecipientMap[donorBloodGroup] || [donorBloodGroup];

const getCompatibleDonorGroupsForRecipient = (recipientBloodGroup) =>
  Object.entries(donorToRecipientMap)
    .filter(([, recipients]) => recipients.includes(recipientBloodGroup))
    .map(([donorGroup]) => donorGroup);

module.exports = {
  getRecipientGroupsForDonor,
  getCompatibleDonorGroupsForRecipient,
};
