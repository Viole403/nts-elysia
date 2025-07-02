export const handleError = (error: any) => {
  console.error('Error:', error);
  if (error instanceof Error) {
    return { message: error.message, status: 500 };
  }
  return { message: 'An unknown error occurred', status: 500 };
};
