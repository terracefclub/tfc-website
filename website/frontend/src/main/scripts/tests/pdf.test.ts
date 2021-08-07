describe('Archive utilities', () => {
  describe('appendDocumentThumbnail', () => {
    it('should silently fail with no url attribute defined');
    it('should log an error if the url is invalid');
    it(
      'should log an error if the page number specified is not valid/in document',
    );
    it('should render a canvas element to the item clicked if all is correct');
  });

  describe('trackAudio', () => {
    // Hefty component loader needs to be refactored or tested e2e
  });
});

describe('Full Archive', () => {
  // needs e2e testing
});
