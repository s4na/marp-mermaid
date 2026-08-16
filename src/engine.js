export default ({ marp }) => {
  const validateLink = marp.markdown.validateLink;

  marp.markdown.validateLink = (url) =>
    /^data:image\/svg\+xml;base64,/i.test(url) || validateLink(url);

  return marp;
};
