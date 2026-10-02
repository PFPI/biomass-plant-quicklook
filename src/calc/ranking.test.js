// National EPA rankings must reproduce Project River's published figures
// (site tract 47011011202, watershed 060200021406), as in r/tests/testthat/test-enviroatlas.R.
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { percentile, prepareRanking, rankText } from './ranking.js'

const rk = (k) => prepareRanking(JSON.parse(readFileSync(new URL(`../../public/data/rankings/${k}.json`, import.meta.url))))
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1e-4)

describe('EPA rankings (Project River site)', () => {
  test('air toxics, census tract', () => {
    near(percentile(0.48985113789, rk('diesel')), 0.6197005)       // "higher than 61%"
    near(percentile(41.0528088591109, rk('cancer')), 0.8749626)    // "higher than 87%"
    near(percentile(0.154787722058216, rk('neuro')), 0.9924166)    // "top 0.8%"
    expect(rankText(percentile(0.154787722058216, rk('neuro')))).toBe('in the top 0.8% of')
  })
  test('respiratory: 99 of 73,450 tracts at or above 1', () => {
    const r = rk('respiratory')
    expect(r.n).toBe(73450)
    expect(Math.round(r.n * (1 - percentile(1, r)))).toBe(99)
  })
  test('watersheds', () => {
    near(percentile(514972.226299, rk('metals')), 0.9991978)       // "top 0.1%"
    near(percentile(15.4936605524049, rk('mercury')), 0.9828258)   // "higher than 98%"
  })
  test('zeros are never ranked high', () => expect(percentile(0, rk('mercury'))).toBe(0))
})
