import * as React from 'react'
import { FlipContext } from './FlipProvider'

export { AnimateInOut }

export const fadeOut = {
  from: { opacity: 1 },
  to: { opacity: 0 },
  duration: 500
}

export const fadeIn = {
  from: { opacity: 0 },
  to: { opacity: 1 },
  duration: 500
}

interface AnimationKeyframe {
  from: {
    [prop: string]: string | number
  }
  to: {
    [prop: string]: string | number
  }
  duration: number
}

interface AnimateInOutProps {
  children: React.ReactNode
  in?: AnimationKeyframe
  out?: AnimationKeyframe
}

interface AnimateInProps {
  children: React.ReactElement
  keyframes?: AnimateInOutProps['in']
  isInitialRender: boolean
}

interface AnimateOutProps {
  children: React.ReactElement
  callback: () => void
  childProps: {
    'data-flip-id': string
    style: React.CSSProperties
  }
  keyframes?: AnimateInOutProps['out']
}

const ChildCountContext = React.createContext({})

const ChildCountProvider: React.FC = ({ children }) => {
  const childCount = React.useRef(0)
  const ctx = {
    onAppear: () => childCount.current++,
    onLeave: () => childCount.current--
  }
  return (
    <ChildCountContext.Provider value={ctx}>
      {children}
    </ChildCountContext.Provider>
  )
}

const getChildKey = (child: React.ReactElement) => {
  return `${child.key}` || ''
}

const onlyValidElements = (children: React.ReactNode) => {
  const filtered: React.ReactElement[] = []

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      filtered.push(child)
    }
  })

  return filtered
}

const AnimateIn: React.FC<AnimateInProps> = (props: AnimateInProps) => {
  const countContext = React.useContext(ChildCountContext)

  const { children, isInitialRender } = props
  const flipId = children.props['data-flip-id']

  React.useLayoutEffect(() => {
    if (!isInitialRender) {
      const elm = document.querySelector(`[data-flip-id=${flipId}`)!

      const keyframes = props.keyframes || fadeIn

      elm.animate([keyframes.from, keyframes.to], {
        duration: keyframes.duration,
        fill: 'both'
      })
    }
  }, [isInitialRender, flipId, props.keyframes])

  return props.children
}

const AnimateOut: React.FC<AnimateOutProps> = (props: AnimateOutProps) => {
  const ref = React.useRef<Element>(null)
  const cachedAnimation = React.useRef<Animation | null>(null)

  React.useLayoutEffect(() => {
    if (!ref.current) return

    const flipId = props.childProps['data-flip-id']

    if (document.querySelector(`[data-flip-id=${flipId}`)) {
      return
    }

    const currAnimation = cachedAnimation.current

    if (currAnimation && currAnimation.playState === 'running') {
      //currAnimation.finish()
      // props.callback()
      return
    }

    const keyframes = props.keyframes || fadeOut

    const animation = ref.current.animate([keyframes.from, keyframes.to], {
      duration: keyframes.duration,
      fill: 'both'
    })

    animation.onfinish = () => {
      props.callback()
    }

    cachedAnimation.current = animation
  })

  // Prevent interactions since the element is treated as non-existent
  const style = { ...(props.childProps.style || {}), pointerEvents: 'none' }

  return (
    <React.Fragment>
      {React.cloneElement(props.children, {
        ...props.childProps,
        style,
        'data-flip-id': undefined, // Prevent shared animations
        ref
      })}
    </React.Fragment>
  )
}

const AnimateInOut = ({
  children,
  in: inKeyframes,
  out
}: AnimateInOutProps): any => {
  const cache = React.useRef(new Map<string, React.ReactElement>()).current
  const exiting = React.useRef(new Set<string>()).current
  const initialRender = React.useRef(true)

  const forceRender = React.useContext(FlipContext)

  const filteredChildren = onlyValidElements(children)

  const presentChildren = React.useRef(filteredChildren)

  React.Children.forEach(filteredChildren, (child) => {
    cache.set(getChildKey(child), child)
  })

  React.useLayoutEffect(() => {
    exiting.forEach((key) => {
      const flipId = cache.get(key)!.props[`data-flip-id`]

      // Force finish animation when some next animation is triggered
      if (document.querySelector(`[data-flip-id=${flipId}]`)) {
        removeFromDOM(key)
      }
    })
  })

  if (initialRender.current) {
    initialRender.current = false
    return filteredChildren.map((child) => (
      <ChildCountProvider key={getChildKey(child)}>
        <AnimateIn keyframes={inKeyframes} isInitialRender>
          {child}
        </AnimateIn>
      </ChildCountProvider>
    ))
  }

  const presentKeys = presentChildren.current.map(getChildKey)
  const targetKeys = filteredChildren.map(getChildKey)

  const removeFromDOM = (key: string) => {
    exiting.delete(key)

    const removeIndex = presentChildren.current.findIndex(
      (child) => child.key === key
    )

    presentChildren.current.splice(removeIndex, 1)

    if (exiting.size === 0) {
      presentChildren.current = filteredChildren
      forceRender()
    }
  }

  for (const key of presentKeys) {
    if (!targetKeys.includes(key)) {
      exiting.add(key)
    } else {
      // In case this key has re-entered, remove from the exiting list
      exiting.delete(key)
    }
  }

  let renderedChildren = [...filteredChildren]

  exiting.forEach((key) => {
    // If this component is actually entering again, early return
    if (targetKeys.indexOf(key) !== -1) return

    const child = cache.get(key)

    if (!child) return

    const removeFromCache = () => {
      removeFromDOM(key)
    }

    const index = presentKeys.indexOf(key)
    const currProps = child.props

    renderedChildren.splice(
      index,
      0,
      <ChildCountProvider key={key}>
        <AnimateOut
          keyframes={out}
          callback={removeFromCache}
          childProps={currProps}
        >
          {child}
        </AnimateOut>
      </ChildCountProvider>
    )
  })

  renderedChildren = renderedChildren.map((child) => {
    if (exiting.has(getChildKey(child))) {
      return child
    }

    return (
      <ChildCountProvider key={getChildKey(child)}>
        <AnimateIn isInitialRender={false}>{child}</AnimateIn>
      </ChildCountProvider>
    )
  })

  presentChildren.current = renderedChildren

  return renderedChildren
}
