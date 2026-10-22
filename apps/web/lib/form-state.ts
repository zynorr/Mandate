export type FormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export const initialFormState: FormState = {
  error: null,
  fieldErrors: {},
};
