import { useEffect, useLayoutEffect, MutableRefObject } from 'react'
import { invertScale, Scale } from './helpers'
import { usePosition } from './usePosition'

type CachedPosition = ReturnType<typeof usePosition>

export const usePreserveScale = (
  flipId: string,
  pscale: MutableRefObject<Scale | null>,
  cachedPosition: CachedPosition,
  dep: any,
  isPlaying: MutableRefObject<boolean>,
  noPreserve: boolean,
) => {
  useLayoutEffect(() => {
    if (noPreserve) return
    const el = document.getElementById(flipId)
    if (!el) return
    if (!pscale.current) return

    for (const child of el.children as HTMLCollectionOf<HTMLElement>) {
      const rScaleX = 1 / pscale.current.scaleX
      const rScaleY = 1 / pscale.current.scaleY
      child.style.transform = `scale(${rScaleX}, ${rScaleY})`
    }
  }, [flipId, pscale, dep, noPreserve])

  useEffect(() => {
    if (noPreserve) return
    let raf: any
    const el = document.getElementById(flipId)
    if (!el) return
    if (cachedPosition.isNull()) return

    function adjustChildScale() {

      if (!isPlaying.current) {
        console.log('STOPPING')
        cancelAnimationFrame(raf)
        return
      }

      const inProgressRect = el!.getBoundingClientRect()
      for (const child of el!.children as HTMLCollectionOf<HTMLElement>) {
        // console.log(child.getBoundingClientRect().left)
        const { scaleX, scaleY } = invertScale(
          inProgressRect,
          cachedPosition.getPosition()!
        )
        const rScaleX = 1 / scaleX
        const rScaleY = 1 / scaleY
        child.style.transform = `scale(${rScaleX}, ${rScaleY})`
      }
      requestAnimationFrame(adjustChildScale)
    }

    raf = requestAnimationFrame(adjustChildScale)
    return () => cancelAnimationFrame(raf)
  }, [flipId, cachedPosition, dep, noPreserve, isPlaying])
}