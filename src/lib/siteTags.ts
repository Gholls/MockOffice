import type { HtmlTagDescriptor } from 'vite'
import { PAGES, WORKFLOW_ENTRY, WORKFLOW_TITLES, type PageMeta } from './site'

/**
 * 由 src/lib/site.ts 的注册表生成每个入口的 head 标签。
 * 站点标题/描述/canonical/结构化数据只在这里产出一次，页面 HTML 不再各自手写。
 */
export const SITE_ORIGIN = 'https://mockoffice.gholl.com'

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : SITE_ORIGIN + path
}

function stepsOf(workflow: PageMeta['workflow']): PageMeta[] {
  if (!workflow) return []
  return PAGES.filter((page) => page.workflow === workflow && page.step).sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
}

function jsonLd(page: PageMeta): unknown {
  const canonical = absoluteUrl(page.redirectsTo ?? page.path)

  if (page.file === 'index.html') {
    const flows = (['w01', 'w02', 'w03'] as const).map((id) => {
      const entry = stepsOf(id)[0]
      return {
        '@type': 'ListItem',
        position: Number(id.slice(1)),
        name: WORKFLOW_TITLES[id],
        url: absoluteUrl(entry?.redirectsTo ?? entry?.path ?? '/'),
      }
    })
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': absoluteUrl('/'),
          url: absoluteUrl('/'),
          name: 'MockOffice',
          inLanguage: 'zh-CN',
          description: page.description,
          publisher: { '@type': 'Organization', '@id': absoluteUrl('/#organization'), name: 'MockOffice' },
          hasPart: { '@type': 'ItemList', name: '评测工作流', itemListElement: flows },
        },
      ],
    }
  }

  if (page.workflow && !page.step) {
    // 流程目录落地页：用 HowTo 描述整条流程的步骤，机器可直接读出任务结构
    const steps = stepsOf(page.workflow)
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: WORKFLOW_TITLES[page.workflow],
      description: page.description,
      url: canonical,
      inLanguage: 'zh-CN',
      totalTime: 'PT5M',
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.heading,
        text: step.intro[0],
        url: absoluteUrl(step.path),
      })),
    }
  }

  const flow = page.workflow
  const trail = [
    { '@type': 'ListItem', position: 1, name: 'MockOffice 主页', item: absoluteUrl('/') },
    ...(flow
      ? [
          {
            '@type': 'ListItem',
            position: 2,
            name: WORKFLOW_TITLES[flow],
            item: absoluteUrl(stepsOf(flow)[0]?.path ?? '/'),
          },
        ]
      : []),
    { '@type': 'ListItem', position: flow ? 3 : 2, name: page.heading, item: canonical },
  ]

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': absoluteUrl('/') },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: trail },
    about: flow ? { '@type': 'Thing', name: WORKFLOW_TITLES[flow] } : undefined,
  }
}

export function headTags(page: PageMeta): HtmlTagDescriptor[] {
  const canonical = absoluteUrl(page.redirectsTo ?? page.path)
  const description = page.description
  const tags: HtmlTagDescriptor[] = [
    { tag: 'title', children: page.title },
    { tag: 'meta', attrs: { name: 'description', content: description } },
    { tag: 'meta', attrs: { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1' } },
    { tag: 'link', attrs: { rel: 'canonical', href: canonical } },
    { tag: 'meta', attrs: { property: 'og:type', content: page.step ? 'article' : 'website' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: 'MockOffice' } },
    { tag: 'meta', attrs: { property: 'og:locale', content: 'zh_CN' } },
    { tag: 'meta', attrs: { property: 'og:title', content: page.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: description } },
    { tag: 'meta', attrs: { property: 'og:url', content: canonical } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: page.title } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: description } },
    // GEO：告诉 LLM/爬虫这份机器可读的站点说明书在哪
    { tag: 'link', attrs: { rel: 'describedby', href: absoluteUrl('/llms.txt') } },
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      children: JSON.stringify(jsonLd(page)),
      injectTo: 'head',
    },
  ]
  return tags
}

/** 落地页需要把浏览器带到流程 A 页 */
export function redirectTargets(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const page of PAGES) {
    if (page.redirectsTo) map[page.file] = page.redirectsTo
  }
  return map
}

export { WORKFLOW_ENTRY }
