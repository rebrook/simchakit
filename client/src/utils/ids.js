// Unique ID generators for all data collections

function newHouseholdId() { return "hh_" + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newPersonId()    { return "p_"  + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newExpenseId()   { return "exp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newVendorId()    { return "v_"   + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newMilestoneId() { return "ms_"  + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newContactId()   { return "cl_"  + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newTaskId()  { return "task_"  + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newPrepId()  { return "prep_"  + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newTableId() { return "table_" + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newGiftId()     { return "gift_"     + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newFavorId()    { return "favor_"    + Date.now() + "_" + Math.random().toString(36).slice(2,7); }
function newTimelineId() { return "tl_"       + Date.now() + "_" + Math.random().toString(36).slice(2,7); }

export {
  newHouseholdId,
  newPersonId,
  newExpenseId,
  newVendorId,
  newMilestoneId,
  newContactId,
  newTaskId,
  newPrepId,
  newTableId,
  newGiftId,
  newFavorId,
  newTimelineId,
};
