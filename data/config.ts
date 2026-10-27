import pkg from '../package.json'

const { author, homepage } = pkg

const subTitle = '· Sammy Ibeh'

export const siteMetadata = {
  name: 'sammyibeh.dev',
  title: 'Sammy Ibeh · Senior Developer, London',
  subTitle,
  siteUrl: homepage,
  description:
    'Sammy Ibeh is a senior developer at the Government Digital Service in London, building cross-government digital services.',
  author,
  twitterUsername: `@${author.twitter}`,
  facebookAppID: '228063441034027',
  // Profiles for the Person schema's sameAs.
  sameAs: [
    `https://github.com/${author.github}`,
    `https://www.linkedin.com/in/${author.linkedin}`,
    `https://twitter.com/${author.twitter}`,
    `https://www.instagram.com/${author.instagram}`,
  ],
}
