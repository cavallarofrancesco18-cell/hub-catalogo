declare module 'mammoth/mammoth.browser' {
  type ConvertResult = {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  };

  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertResult>;
  };

  export default mammoth;
}
