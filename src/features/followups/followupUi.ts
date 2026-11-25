/**
 * Larger text for the follow-up popups (Complete, Reschedule, the follow-up call form): field labels 14px,
 * typed text 15px and taller inputs. Applied on the form's wrapper so the app-wide Field / Input sizes stay as they are.
 */
export const FOLLOWUP_FORM_TEXT =
  '[&_[data-slot=field]>label]:text-[14px] [&_input:not([type=checkbox])]:h-11 [&_input]:text-[15px] [&_textarea]:text-[15px]'
