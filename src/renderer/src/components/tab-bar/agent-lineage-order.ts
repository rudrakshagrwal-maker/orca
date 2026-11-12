// RA: stable preorder keeps each parent and its descendants contiguous after launches, drags and restores.
export function orderAgentLineage(
  ids: readonly string[],
  parents: ReadonlyMap<string, string>
): string[] {
  const present = new Set(ids)
  const validParents = new Map<string, string>()
  for (const id of ids) {
    const parent = parents.get(id)
    if (!parent || parent === id || !present.has(parent)) {
      continue
    }
    const seen = new Set([id])
    let ancestor: string | undefined = parent
    while (ancestor && !seen.has(ancestor)) {
      seen.add(ancestor)
      ancestor = parents.get(ancestor)
    }
    if (!ancestor) {
      validParents.set(id, parent)
    }
  }
  const children = new Map<string, string[]>()
  for (const id of ids) {
    const parent = validParents.get(id)
    if (parent) {
      children.set(parent, [...(children.get(parent) ?? []), id])
    }
  }
  const result: string[] = []
  const append = (id: string): void => {
    result.push(id)
    for (const child of children.get(id) ?? []) {
      append(child)
    }
  }
  for (const id of ids) {
    if (!validParents.has(id)) {
      append(id)
    }
  }
  return result
}

export function agentLineageGroup(id: string, parents: ReadonlyMap<string, string>): Set<string> {
  const group = new Set([id])
  for (let changed = true; changed;) {
    changed = false
    for (const [child, parent] of parents) {
      if (group.has(parent) && !group.has(child)) {
        group.add(child)
        changed = true
      }
    }
  }
  return group
}

export function moveAgentLineageGroup(
  order: readonly string[],
  id: string,
  index: number,
  parents: ReadonlyMap<string, string>
): string[] {
  const group = agentLineageGroup(id, parents)
  const moving = order.filter((key) => group.has(key))
  const before = order.slice(0, index).filter((key) => !group.has(key)).length
  const remaining = order.filter((key) => !group.has(key))
  remaining.splice(before, 0, ...moving)
  return orderAgentLineage(remaining, parents)
}
